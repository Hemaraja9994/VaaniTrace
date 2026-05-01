import worker from "../../apps/api/src/index";
import type { Env } from "../../apps/api/src/types";

export function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  return worker.fetch(context.request, context.env);
}
