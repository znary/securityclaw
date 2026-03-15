import os from "node:os";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ApprovalSubjectResolver } from "../domain/services/approval_subject_resolver.ts";

type JsonRecord = Record<string, unknown>;

type RawSessionMetadata = {
  sessionId?: unknown;
  updatedAt?: unknown;
  chatType?: unknown;
  lastChannel?: unknown;
  deliveryContext?: {
    channel?: unknown;
  };
  origin?: {
    provider?: unknown;
    surface?: unknown;
    chatType?: unknown;
  };
  sessionFile?: unknown;
};

export type OpenClawChatSession = {
  subject: string;
  label: string;
  session_key: string;
  session_id?: string;
  agent_id?: string;
  channel?: string;
  provider?: string;
  chat_type?: string;
  updated_at?: string;
  session_file?: string;
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return undefined;
}

function readSessionFile(filePath: string): JsonRecord {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as JsonRecord;
}

export function listOpenClawChatSessions(openClawHome = path.join(os.homedir(), ".openclaw")): OpenClawChatSession[] {
  const agentsDir = path.join(openClawHome, "agents");
  if (!existsSync(agentsDir)) {
    return [];
  }

  const deduped = new Map<string, OpenClawChatSession>();
  for (const agentEntry of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!agentEntry.isDirectory()) {
      continue;
    }

    const agentId = agentEntry.name;
    const sessionsPath = path.join(agentsDir, agentId, "sessions", "sessions.json");
    if (!existsSync(sessionsPath)) {
      continue;
    }

    const rawSessions = readSessionFile(sessionsPath);
    for (const [sessionKey, rawMetadata] of Object.entries(rawSessions)) {
      if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
        continue;
      }

      const metadata = rawMetadata as RawSessionMetadata;
      const sessionId = normalizeString(metadata.sessionId);
      const channel =
        normalizeString(metadata.deliveryContext?.channel) ??
        normalizeString(metadata.lastChannel);
      const provider =
        normalizeString(metadata.origin?.provider) ??
        normalizeString(metadata.origin?.surface);
      const chatType =
        normalizeString(metadata.chatType) ??
        normalizeString(metadata.origin?.chatType);
      const updatedAt = normalizeTimestamp(metadata.updatedAt);
      const sessionFile = normalizeString(metadata.sessionFile);
      const subject = ApprovalSubjectResolver.resolve({
        agentId,
        sessionKey,
        ...(sessionId ? { sessionId } : {}),
        ...(channel ? { channelId: channel } : {})
      });

      const entry: OpenClawChatSession = {
        subject,
        label: subject,
        session_key: sessionKey,
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(channel ? { channel } : {}),
        ...(provider ? { provider } : {}),
        ...(chatType ? { chat_type: chatType } : {}),
        ...(updatedAt ? { updated_at: updatedAt } : {}),
        ...(sessionFile ? { session_file: sessionFile } : {}),
        agent_id: agentId
      };

      const previous = deduped.get(subject);
      const previousTs = previous?.updated_at ? Date.parse(previous.updated_at) : Number.NEGATIVE_INFINITY;
      const nextTs = entry.updated_at ? Date.parse(entry.updated_at) : Number.NEGATIVE_INFINITY;
      if (!previous || nextTs >= previousTs) {
        deduped.set(subject, entry);
      }
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const rightTs = right.updated_at ? Date.parse(right.updated_at) : Number.NEGATIVE_INFINITY;
    const leftTs = left.updated_at ? Date.parse(left.updated_at) : Number.NEGATIVE_INFINITY;
    if (rightTs !== leftTs) {
      return rightTs - leftTs;
    }
    return left.subject.localeCompare(right.subject);
  });
}
