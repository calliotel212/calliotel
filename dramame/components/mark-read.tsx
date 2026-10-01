"use client";

import { useFormStatus } from "react-dom";

function ReadBox({ read }: { read: boolean }) {
  const { pending } = useFormStatus();
  return (
    <label className="check">
      <input
        key={read ? "read" : "unread"}
        type="checkbox"
        defaultChecked={read}
        disabled={pending}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit();
        }}
      />
      <span>Mark as read</span>
    </label>
  );
}

export function MarkRead({
  action,
  id,
  read,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  read: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="read" value={read ? "0" : "1"} />
      <ReadBox read={read} />
    </form>
  );
}
