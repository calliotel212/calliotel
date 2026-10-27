import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ALREADY_GENERATING_MESSAGE,
  advanceGenerationStep,
  claimGeneration,
  markGenerationFailed,
  runBackgroundShotLoop,
} from "./pipeline.ts";

type MemoryDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<unknown>;
    all(...params: unknown[]): Promise<unknown[]>;
    run(...params: unknown[]): Promise<unknown>;
  };
};

type ShotRecord = {
  shot_index: number;
  status: string;
  clip_url: string | null;
  error: string | null;
  prompt: string;
};

type VideoRecord = {
  status: string;
  output_url: string | null;
  error: string | null;
};

function createDb(): { database: DatabaseSync; db: MemoryDb } {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE videos (
      id TEXT PRIMARY KEY,
      script_text TEXT,
      status TEXT NOT NULL,
      output_url TEXT,
      error TEXT,
      shot_list_json TEXT,
      updated_at INTEGER
    );
    CREATE TABLE shots (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      status TEXT NOT NULL,
      clip_url TEXT,
      error TEXT
    );
  `);
  return {
    database,
    db: {
      prepare(sql: string) {
        const statement = database.prepare(sql);
        return {
          get(...params: unknown[]) {
            return Promise.resolve(statement.get(...(params as never[])));
          },
          all(...params: unknown[]) {
            return Promise.resolve(statement.all(...(params as never[])));
          },
          run(...params: unknown[]) {
            return Promise.resolve(statement.run(...(params as never[])));
          },
        };
      },
    },
  };
}

function insertVideo(database: DatabaseSync, id: string, status = "queued", error: string | null = null, output: string | null = null) {
  database
    .prepare(
      `INSERT INTO videos (id, script_text, status, output_url, error, shot_list_json, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 0)`,
    )
    .run(id, "One. Two. Three. Four. Five. Six. Seven.", status, output, error);
}

function insertShot(
  database: DatabaseSync,
  videoId: string,
  index: number,
  status: string,
  prompt = `Prompt ${index}`,
  clip: string | null = null,
  error: string | null = null,
) {
  database
    .prepare(
      `INSERT INTO shots (id, video_id, "index", prompt, duration_seconds, status, clip_url, error)
       VALUES (?, ?, ?, ?, 10, ?, ?, ?)`,
    )
    .run(`${videoId}-${index}`, videoId, index, prompt, status, clip, error);
}

function videoOf(database: DatabaseSync, id: string): VideoRecord {
  return database.prepare("SELECT status, output_url, error FROM videos WHERE id = ?").get(id) as VideoRecord;
}

function shotsOf(database: DatabaseSync, id: string): ShotRecord[] {
  return database
    .prepare(`SELECT "index" AS shot_index, status, clip_url, error, prompt FROM shots WHERE video_id = ? ORDER BY "index"`)
    .all(id) as ShotRecord[];
}

const savedFetch = globalThis.fetch;

test("advanceGenerationStep generates only the first queued shot", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1");
  for (let index = 1; index <= 7; index += 1) insertShot(database, "v1", index, "queued");
  const calls: string[] = [];
  globalThis.fetch = async () => {
    throw new Error("refusing live network");
  };

  try {
    const result = await advanceGenerationStep("v1", {
      db,
      generateClip: async (prompt) => {
        calls.push(prompt);
        return "https://example.com/clip-1.mp4";
      },
    });
    assert.deepEqual(calls, ["Prompt 1"]);
    assert.equal(result.status, "generating");
    assert.equal(result.remaining, 6);
    assert.equal(result.shot?.index, 1);
    assert.equal(result.shot?.clipUrl, "https://example.com/clip-1.mp4");
    const shots = shotsOf(database, "v1");
    assert.equal(shots[0]?.status, "ready");
    assert.equal(shots[0]?.clip_url, "https://example.com/clip-1.mp4");
    assert.ok(shots.slice(1).every((shot) => shot.status === "queued" && shot.clip_url === null));
    assert.equal(videoOf(database, "v1").status, "generating");

    const second = await advanceGenerationStep("v1", {
      db,
      generateClip: async (prompt) => {
        calls.push(prompt);
        return "https://example.com/clip-2.mp4";
      },
    });
    assert.deepEqual(calls, ["Prompt 1", "Prompt 2"]);
    assert.equal(second.status, "generating");
    assert.equal(second.remaining, 5);
    assert.equal(shotsOf(database, "v1")[2]?.status, "queued");
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("the last queued shot marks the video ready", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1", "generating");
  insertShot(database, "v1", 1, "ready", "Prompt 1", "https://example.com/first.mp4");
  insertShot(database, "v1", 2, "queued", "Prompt 2");
  let calls = 0;
  const result = await advanceGenerationStep("v1", {
    db,
    generateClip: async () => {
      calls += 1;
      return "https://example.com/second.mp4";
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "ready");
  assert.equal(result.remaining, 0);
  assert.equal(result.outputUrl, "https://example.com/first.mp4");
  assert.equal(videoOf(database, "v1").status, "ready");
  assert.equal(videoOf(database, "v1").output_url, "https://example.com/first.mp4");
  assert.equal(videoOf(database, "v1").error, null);
});

test("a Kling failure marks that shot and the video failed", async () => {
  const savedKey = process.env.FAL_API_KEY;
  const savedError = console.error;
  const logs: string[] = [];
  console.error = (message?: unknown) => {
    logs.push(String(message ?? ""));
  };
  process.env.FAL_API_KEY = "fal-test-secret";
  const { database, db } = createDb();
  insertVideo(database, "v1", "generating");
  insertShot(database, "v1", 1, "ready", "Prompt 1", "https://example.com/first.mp4");
  insertShot(database, "v1", 2, "queued", "Prompt 2");
  insertShot(database, "v1", 3, "queued", "Prompt 3");
  let calls = 0;

  try {
    const thrown = await advanceGenerationStep("v1", {
      db,
      generateClip: async () => {
        calls += 1;
        throw new Error("Kling rejected fal-test-secret");
      },
    });
    assert.equal(calls, 1);
    assert.equal(thrown.status, "failed");
    assert.equal(thrown.shot?.index, 2);
    assert.equal(thrown.shot?.status, "failed");
    assert.match(thrown.error ?? "", /Kling rejected \[redacted\]/);
    assert.equal((thrown.error ?? "").includes("fal-test-secret"), false);
    const shots = shotsOf(database, "v1");
    assert.equal(shots[1]?.status, "failed");
    assert.equal(shots[1]?.error?.includes("fal-test-secret"), false);
    assert.match(shots[1]?.error ?? "", /Kling rejected \[redacted\]/);
    assert.equal(shots[2]?.status, "queued");
    assert.equal(shots.some((shot) => shot.status === "generating"), false);
    assert.equal(videoOf(database, "v1").status, "failed");
    assert.equal((videoOf(database, "v1").error ?? "").includes("fal-test-secret"), false);
    assert.equal(logs.some((line) => line.includes("fal-test-secret")), false);

    const { database: emptyKeyDb, db: emptyKey } = createDb();
    const emptyDatabase = emptyKeyDb;
    insertVideo(emptyDatabase, "v2", "generating");
    insertShot(emptyDatabase, "v2", 1, "queued", "Prompt 1");
    delete process.env.FAL_API_KEY;
    const missing = await advanceGenerationStep("v2", {
      db: emptyKey,
      generateClip: async () => null,
    });
    assert.equal(missing.status, "failed");
    assert.equal(missing.error, "FAL_API_KEY is not set.");
    assert.equal(shotsOf(emptyDatabase, "v2")[0]?.status, "failed");
    assert.equal(videoOf(emptyDatabase, "v2").status, "failed");

    process.env.FAL_API_KEY = "fal-test-secret";
    const { database: keyedDatabase, db: keyed } = createDb();
    insertVideo(keyedDatabase, "v3", "generating");
    insertShot(keyedDatabase, "v3", 4, "queued", "Prompt 4");
    const failedClip = await advanceGenerationStep("v3", {
      db: keyed,
      generateClip: async () => null,
    });
    assert.equal(failedClip.error, "Clip generation failed for shot 4.");
    assert.equal(shotsOf(keyedDatabase, "v3")[0]?.status, "failed");
    assert.equal(videoOf(keyedDatabase, "v3").status, "failed");
  } finally {
    console.error = savedError;
    if (savedKey === undefined) delete process.env.FAL_API_KEY;
    else process.env.FAL_API_KEY = savedKey;
  }
});

test("retry requeues failed and stuck shots, then generates only the first", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1", "failed", "Clip generation failed for shot 2.");
  insertShot(database, "v1", 1, "ready", "Prompt 1", "https://example.com/first.mp4");
  insertShot(database, "v1", 2, "failed", "Prompt 2", null, "Clip generation failed for shot 2.");
  insertShot(database, "v1", 3, "generating", "Prompt 3");
  insertShot(database, "v1", 4, "queued", "Prompt 4");
  const calls: string[] = [];
  const result = await advanceGenerationStep("v1", {
    retry: true,
    db,
    generateClip: async (prompt) => {
      calls.push(prompt);
      return "https://example.com/second.mp4";
    },
  });
  assert.deepEqual(calls, ["Prompt 2"]);
  assert.equal(result.status, "generating");
  const shots = shotsOf(database, "v1");
  assert.equal(shots[0]?.status, "ready");
  assert.equal(shots[0]?.clip_url, "https://example.com/first.mp4");
  assert.equal(shots[1]?.status, "ready");
  assert.equal(shots[2]?.status, "queued");
  assert.equal(shots[3]?.status, "queued");
  assert.equal(videoOf(database, "v1").status, "generating");
  assert.equal(videoOf(database, "v1").error, null);

  const next = await advanceGenerationStep("v1", {
    db,
    generateClip: async (prompt) => {
      calls.push(prompt);
      return "https://example.com/third.mp4";
    },
  });
  assert.deepEqual(calls, ["Prompt 2", "Prompt 3"]);
  assert.equal(next.remaining, 1);
  assert.equal(shotsOf(database, "v1")[3]?.status, "queued");
});

test("a failed video does not generate until retry, and a finished stuck video becomes ready", async () => {
  const { database, db } = createDb();
  insertVideo(database, "failed-video", "failed", "Clip generation failed for shot 1.");
  insertShot(database, "failed-video", 1, "failed", "Prompt 1", null, "Clip generation failed for shot 1.");
  insertShot(database, "failed-video", 2, "queued", "Prompt 2");
  let calls = 0;
  const blocked = await advanceGenerationStep("failed-video", {
    db,
    generateClip: async () => {
      calls += 1;
      return "https://example.com/nope.mp4";
    },
  });
  assert.equal(calls, 0);
  assert.equal(blocked.status, "failed");
  assert.equal(shotsOf(database, "failed-video")[1]?.status, "queued");

  insertVideo(database, "stuck-ready", "generating");
  insertShot(database, "stuck-ready", 1, "ready", "Prompt 1", "https://example.com/done.mp4");
  insertShot(database, "stuck-ready", 2, "ready", "Prompt 2", "https://example.com/done-2.mp4");
  const ready = await advanceGenerationStep("stuck-ready", {
    retry: true,
    db,
    generateClip: async () => {
      calls += 1;
      throw new Error("already finished");
    },
  });
  assert.equal(calls, 0);
  assert.equal(ready.status, "ready");
  assert.equal(ready.outputUrl, "https://example.com/done.mp4");
  assert.equal(videoOf(database, "stuck-ready").status, "ready");
});

test("a video with no shots plans seven and generates the first", async () => {
  const savedLog = console.log;
  const savedImage = process.env.DRAMAME_START_IMAGE_URL;
  console.log = () => {};
  delete process.env.DRAMAME_START_IMAGE_URL;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  const { database, db } = createDb();
  insertVideo(database, "v1", "queued");
  const calls: string[] = [];
  try {
    const result = await advanceGenerationStep("v1", {
      db,
      generateClip: async (prompt, imageUrl, duration) => {
        calls.push(`${prompt}|${imageUrl}|${duration}`);
        return "https://example.com/planned.mp4";
      },
    });
    assert.deepEqual(calls, ["One.||10"]);
    assert.equal(result.shots.length, 7);
    assert.equal(result.remaining, 6);
    assert.equal(shotsOf(database, "v1").filter((shot) => shot.status === "ready").length, 1);
    assert.equal(shotsOf(database, "v1").filter((shot) => shot.status === "queued").length, 6);
  } finally {
    console.log = savedLog;
    globalThis.fetch = savedFetch;
    if (savedImage === undefined) delete process.env.DRAMAME_START_IMAGE_URL;
    else process.env.DRAMAME_START_IMAGE_URL = savedImage;
  }
});

test("markGenerationFailed stores the error on the in-progress shot and the video", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1", "generating");
  insertShot(database, "v1", 1, "ready", "Prompt 1", "https://example.com/first.mp4");
  insertShot(database, "v1", 2, "generating", "Prompt 2");
  insertShot(database, "v1", 3, "queued", "Prompt 3");
  await markGenerationFailed("v1", "Kling timed out", db);
  const shots = shotsOf(database, "v1");
  assert.equal(shots[0]?.status, "ready");
  assert.equal(shots[1]?.status, "failed");
  assert.equal(shots[1]?.error, "Kling timed out");
  assert.equal(shots[2]?.status, "queued");
  assert.equal(videoOf(database, "v1").status, "failed");
  assert.equal(videoOf(database, "v1").error, "Kling timed out");
});

test("the video page starts one background generation and polls until ready or failed", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const section = fs.readFileSync(path.join(root, "components/video-status-section.tsx"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/api/generate/background/[id]/route.ts"), "utf8");
  const stepRoute = fs.readFileSync(path.join(root, "app/api/generate/step/[id]/route.ts"), "utf8");
  assert.match(section, /Retry failed shots/);
  assert.match(section, /Generating\.\.\./);
  assert.match(section, /\/api\/generate\/background\//);
  assert.equal(section.includes("/api/generate/step/"), false);
  assert.match(section, /5000/);
  assert.match(section, /status === "failed" \|\| brokenShot/);
  assert.match(section, /status === "generating" \|\| status === "assembling"/);
  assert.match(route, /from "@vercel\/functions"/);
  assert.match(route, /waitUntil/);
  assert.match(route, /so the client does not have to keep the tab open/);
  assert.match(route, /maxDuration = 900/);
  assert.match(route, /claimGeneration/);
  assert.match(route, /runBackgroundShotLoop/);
  assert.equal(route.includes("generateClip"), false);
  const refused = route.indexOf("status: 400");
  const claimed = route.indexOf("claimGeneration(");
  const background = route.indexOf("waitUntil(");
  assert.ok(refused !== -1 && claimed !== -1 && background !== -1);
  assert.ok(refused < background);
  assert.ok(claimed < background);
  assert.match(stepRoute, /advanceGenerationStep/);
  assert.match(stepRoute, /maxDuration = 300/);
  assert.match(stepRoute, /markGenerationFailed/);
});

test("a second claim does not start another generation while one is in progress", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1", "queued");
  insertShot(database, "v1", 1, "queued", "Prompt 1");
  insertShot(database, "v1", 2, "queued", "Prompt 2");

  const first = await claimGeneration("v1", db);
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.previousStatus, "queued");
  assert.equal(videoOf(database, "v1").status, "generating");
  assert.equal(videoOf(database, "v1").error, null);

  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = () => {};
  const shotStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const calls: string[] = [];
  const loop = runBackgroundShotLoop("v1", {
    db,
    generateClip: async (prompt) => {
      calls.push(prompt);
      if (calls.length === 1) {
        started();
        await gate;
      }
      return `https://example.com/${calls.length}.mp4`;
    },
  });

  await shotStarted;
  const second = await claimGeneration("v1", db);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.message, ALREADY_GENERATING_MESSAGE);
  assert.equal(ALREADY_GENERATING_MESSAGE, "Video is already generating. Please wait.");
  let extraCalls = 0;
  if (second.ok) {
    await runBackgroundShotLoop("v1", {
      db,
      generateClip: async () => {
        extraCalls += 1;
        return "https://example.com/extra.mp4";
      },
    });
  }
  release();
  const result = await loop;
  assert.equal(extraCalls, 0);
  assert.deepEqual(calls, ["Prompt 1", "Prompt 2"]);
  assert.equal(result.status, "ready");
  assert.equal(videoOf(database, "v1").status, "ready");
  assert.equal(shotsOf(database, "v1").every((shot) => shot.status === "ready"), true);
});

test("claim refuses generating, assembling, and ready without changing them", async () => {
  const { database, db } = createDb();
  insertVideo(database, "busy", "generating");
  insertShot(database, "busy", 1, "queued", "Prompt 1");
  const generating = await claimGeneration("busy", db);
  assert.equal(generating.ok, false);
  if (!generating.ok) assert.equal(generating.message, "Video is already generating. Please wait.");
  assert.equal(videoOf(database, "busy").status, "generating");

  insertVideo(database, "assemble", "assembling");
  const assembling = await claimGeneration("assemble", db);
  assert.equal(assembling.ok, false);
  if (!assembling.ok) assert.equal(assembling.message, "Video is already generating. Please wait.");
  assert.equal(videoOf(database, "assemble").status, "assembling");

  insertVideo(database, "done", "ready", null, "https://example.com/done.mp4");
  const ready = await claimGeneration("done", db);
  assert.equal(ready.ok, false);
  if (!ready.ok) assert.equal(ready.message, "Video is already ready.");
  assert.equal(videoOf(database, "done").status, "ready");
  assert.equal(videoOf(database, "done").output_url, "https://example.com/done.mp4");
});

test("parallel claims let only one generation proceed", async () => {
  const { database, db } = createDb();
  insertVideo(database, "v1", "queued");
  const claims = await Promise.all([claimGeneration("v1", db), claimGeneration("v1", db)]);
  const winners = claims.filter((claim) => claim.ok);
  const losers = claims.filter((claim) => !claim.ok);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(losers[0] && "message" in losers[0] ? losers[0].message : "", "Video is already generating. Please wait.");
  assert.equal(videoOf(database, "v1").status, "generating");
});

test("the background loop generates every shot and stops on the first failure", async () => {
  const savedError = console.error;
  console.error = () => {};
  const { database, db } = createDb();
  insertVideo(database, "v1", "failed", "Clip generation failed for shot 2.");
  insertShot(database, "v1", 1, "ready", "Prompt 1", "https://example.com/first.mp4");
  insertShot(database, "v1", 2, "failed", "Prompt 2", null, "old failure");
  insertShot(database, "v1", 3, "queued", "Prompt 3");
  insertShot(database, "v1", 4, "queued", "Prompt 4");
  const claim = await claimGeneration("v1", db);
  assert.equal(claim.ok, true);
  if (claim.ok) assert.equal(claim.previousStatus, "failed");

  const calls: string[] = [];
  try {
    const failed = await runBackgroundShotLoop("v1", {
      db,
      retry: true,
      generateClip: async (prompt) => {
        calls.push(prompt);
        if (prompt === "Prompt 3") throw new Error("Kling rejected the shot");
        return `https://example.com/${prompt}.mp4`;
      },
    });
    assert.deepEqual(calls, ["Prompt 2", "Prompt 3"]);
    assert.equal(failed.status, "failed");
    const shots = shotsOf(database, "v1");
    assert.equal(shots[0]?.status, "ready");
    assert.equal(shots[0]?.clip_url, "https://example.com/first.mp4");
    assert.equal(shots[1]?.status, "ready");
    assert.equal(shots[2]?.status, "failed");
    assert.match(shots[2]?.error ?? "", /Kling rejected the shot/);
    assert.equal(shots[3]?.status, "queued");
    assert.equal(videoOf(database, "v1").status, "failed");
    assert.match(videoOf(database, "v1").error ?? "", /Kling rejected the shot/);

    const blocked = await claimGeneration("v1", db);
    assert.equal(blocked.ok, true);
    calls.length = 0;
    const finished = await runBackgroundShotLoop("v1", {
      db,
      retry: true,
      generateClip: async (prompt) => {
        calls.push(prompt);
        return "https://example.com/rest.mp4";
      },
    });
    assert.deepEqual(calls, ["Prompt 3", "Prompt 4"]);
    assert.equal(finished.status, "ready");
    assert.equal(videoOf(database, "v1").status, "ready");
    assert.equal(videoOf(database, "v1").error, null);
    assert.equal(shotsOf(database, "v1")[0]?.clip_url, "https://example.com/first.mp4");
  } finally {
    console.error = savedError;
  }
});

test("a thrown background loop marks the video failed and does not continue", async () => {
  const savedError = console.error;
  console.error = () => {};
  const { database, db } = createDb();
  insertVideo(database, "v1", "generating");
  insertShot(database, "v1", 1, "queued", "Prompt 1");
  insertShot(database, "v1", 2, "queued", "Prompt 2");
  const calls: string[] = [];
  const flaky = {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        get: (...params: unknown[]) => statement.get(...params),
        all: (...params: unknown[]) => statement.all(...params),
        run: (...params: unknown[]) => {
          if (sql.includes("UPDATE shots SET status = ?, clip_url")) return Promise.reject(new Error("disk full"));
          return statement.run(...params);
        },
      };
    },
  };

  try {
    const result = await runBackgroundShotLoop("v1", {
      db: flaky,
      generateClip: async (prompt) => {
        calls.push(prompt);
        return "https://example.com/clip.mp4";
      },
    });
    assert.deepEqual(calls, ["Prompt 1"]);
    assert.equal(result.status, "failed");
    assert.match(result.error ?? "", /disk full/);
    assert.equal(videoOf(database, "v1").status, "failed");
    assert.match(videoOf(database, "v1").error ?? "", /disk full/);
    assert.equal(shotsOf(database, "v1")[0]?.status, "failed");
    assert.equal(shotsOf(database, "v1")[1]?.status, "queued");
  } finally {
    console.error = savedError;
  }
});
