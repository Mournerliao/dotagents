export type AllowScope = "off" | "once" | "session";

export type PermissionOption = {
  optionId: string;
  name: string;
  kind?: string;
};

export type PermissionContentBlock = {
  type: string;
  content?: { type: string; text?: string };
};

export type PermissionToolCall = {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  content?: PermissionContentBlock[];
};

export type PermissionParams = {
  sessionId: string;
  toolCall: PermissionToolCall;
  options: PermissionOption[];
};

export function takeAllow(scope: AllowScope): { autoAllow: boolean; next: AllowScope } {
  switch (scope) {
    case "once":
      return { autoAllow: true, next: "off" };
    case "session":
      return { autoAllow: true, next: "session" };
    default:
      return { autoAllow: false, next: "off" };
  }
}

/**
 * Print-mode grant bound to turn start so a compaction request cannot spend it.
 */
export type AllowGrant = {
  set: (scope: AllowScope) => void;
  claimForTurn: () => boolean;
};

export function createAllowGrant(initial: AllowScope = "off"): AllowGrant {
  let scope: AllowScope = initial;
  return {
    set(next) {
      scope = next;
    },
    claimForTurn() {
      const { autoAllow, next } = takeAllow(scope);
      scope = next;
      return autoAllow;
    },
  };
}

export function parseAllowArg(args: string): AllowScope | undefined {
  const mode = args.trim().toLowerCase();
  if (mode === "" || mode === "once") return "once";
  if (mode === "session") return "session";
  if (mode === "off" || mode === "never") return "off";
  return undefined;
}

function isAllowAlways(option: PermissionOption): boolean {
  return option.optionId === "allow-always" || option.kind === "allow_always";
}

export function displayLabel(option: PermissionOption): string {
  if (isAllowAlways(option)) {
    return `${option.name} (writes ~/.cursor/cli-config.json)`;
  }
  return option.name;
}

export function permissionLabels(options: readonly PermissionOption[]): string[] {
  return options.map(displayLabel);
}

function contentText(request: PermissionParams): string {
  const blocks = request.toolCall.content ?? [];
  return blocks
    .map((block) => block.content?.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function permissionTitle(request: PermissionParams): string {
  const title = request.toolCall.title?.trim() || "Cursor tool";
  const detail = contentText(request);
  return detail ? `${title}\n${detail}` : title;
}

export type PermissionDecision =
  | {
      kind: "ask";
      title: string;
      labels: string[];
      optionIdFor: (label: string) => string | undefined;
    }
  | { kind: "selected"; optionId: string; hint?: string };

function optionIdNamed(options: readonly PermissionOption[], id: string): string {
  return options.some((option) => option.optionId === id) ? id : (options[0]?.optionId ?? id);
}

export function decidePermission(input: {
  hasUI: boolean;
  autoAllow: boolean;
  request: PermissionParams;
}): PermissionDecision {
  const options = input.request.options;
  const labels = permissionLabels(options);
  const title = permissionTitle(input.request);

  if (input.hasUI) {
    return {
      kind: "ask",
      title,
      labels,
      optionIdFor: (label) => {
        const index = labels.indexOf(label);
        return index >= 0 ? options[index]?.optionId : undefined;
      },
    };
  }

  if (input.autoAllow) {
    return { kind: "selected", optionId: optionIdNamed(options, "allow-once") };
  }

  return {
    kind: "selected",
    optionId: optionIdNamed(options, "reject-once"),
    hint: [
      "",
      "Cursor asked for approval and there is no UI to answer:",
      title
        .split("\n")
        .map((line) => `- ${line}`)
        .join("\n"),
      "Run /cursor-allow then retry, or confirm in a TUI session.",
      "",
    ].join("\n"),
  };
}
