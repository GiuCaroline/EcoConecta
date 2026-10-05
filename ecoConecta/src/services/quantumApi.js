import { api } from "./api";
export async function requestQuantum({ volumeA, volumeB, requestIds }) {
  return api.apiRequest(
    `/api/quantum/${requestIds ? "recommendation" : "demo"}`,
    {
      method: "POST",
      auth: Boolean(requestIds),
      body: requestIds ? { requestIds } : { volumeA, volumeB },
    },
  );
}
