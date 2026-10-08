import { Fragment, type ReactNode } from "react";

/**
 * Puts elements (a link, a bold name) into a translated sentence at its
 * {placeholders}, so the sentence stays whole for translation:
 * withNodes(t("Fact-check by {publisher}"), { publisher: <a …>…</a> }).
 * Placeholders without a node stay as they are. No hooks: server and client.
 */
export function withNodes(text: string, nodes: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}
