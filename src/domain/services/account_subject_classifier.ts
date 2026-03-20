type AccountRecordLike = {
  subject?: string;
  session_key?: string;
  chat_type?: string;
};

const DIRECT_CHAT_TYPES = new Set(["direct", "dm", "private"]);
const NON_ACCOUNT_CHAT_TYPES = new Set(["group", "channel", "room", "thread", "topic"]);
const NON_ACCOUNT_SCOPE_MARKERS = [":group:", ":channel:", ":thread:", ":topic:"];

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isMainSessionSubject(value: string): boolean {
  const match = value.match(/^agent:([^:]+):([^:]+)$/);
  return Boolean(match && (match[2] === "main" || match[2] === match[1]));
}

function hasNonAccountScope(value: string): boolean {
  return NON_ACCOUNT_SCOPE_MARKERS.some((marker) => value.includes(marker));
}

function isEphemeralSubject(value: string): boolean {
  return value.startsWith("session:") || value.startsWith("fallback:");
}

export function isManageableAccountRecord(record: AccountRecordLike | undefined): boolean {
  if (!record) {
    return false;
  }

  const chatType = normalizeString(record.chat_type)?.toLowerCase();
  if (chatType && NON_ACCOUNT_CHAT_TYPES.has(chatType)) {
    return false;
  }
  if (chatType && DIRECT_CHAT_TYPES.has(chatType)) {
    return true;
  }

  const sessionKey = normalizeString(record.session_key);
  if (sessionKey) {
    if (isMainSessionSubject(sessionKey)) {
      return true;
    }
    if (hasNonAccountScope(sessionKey) || isEphemeralSubject(sessionKey)) {
      return false;
    }
    if (sessionKey.includes(":direct:") || sessionKey.includes(":slash:")) {
      return true;
    }
  }

  const subject = normalizeString(record.subject);
  if (!subject) {
    return false;
  }
  if (isMainSessionSubject(subject)) {
    return true;
  }
  if (hasNonAccountScope(subject) || isEphemeralSubject(subject)) {
    return false;
  }
  return !subject.startsWith("agent:");
}
