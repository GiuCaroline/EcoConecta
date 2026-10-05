import { useEffect, useRef, useState } from "react";
import { Feedback } from "../utils/feedback";
export function useAction(title = "Não foi possível concluir") {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(task) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      return await task();
    } catch (error) {
      Feedback.alert(title, error.message || "Tente novamente.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, run };
}
