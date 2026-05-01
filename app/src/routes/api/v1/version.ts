import { agentJson } from "~/lib/agent-api/response.server";

export async function GET() {
  return agentJson({
    apiVersion: "1",
    minimumCliVersion: "0.1.0",
    recommendedCliVersion: "0.1.0",
  });
}
