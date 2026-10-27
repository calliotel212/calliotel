import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { advanceGenerationStep, markGenerationFailed } from "./pipeline.ts";

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

test("the video page loops one step at a time and can retry", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const section = fs.readFileSync(path.join(root, "components/video-status-section.tsx"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/api/generate/step/[id]/route.ts"), "utf8");
  assert.match(section, /Retry failed shots/);
  assert.match(section, /\/api\/generate\/step\//);
  assert.match(section, /setTimeout/);
  assert.match(section, /5000/);
  assert.match(route, /advanceGenerationStep/);
  assert.match(route, /maxDuration = 300/);
  assert.match(route, /markGenerationFailed/);
});
