// Isolated clock — keeps the once-per-second re-render scoped to this subtree
// instead of re-rendering the entire dashboard.

import { memo, useEffect, useState } from "react";
import Bow from "./components/Bow";
import Spark from "./components/Spark";

const tickAlignedToSecond = (cb: () => void) => {
  const ms = 1000 - (Date.now() % 1000);
  return setTimeout(cb, ms);
};

const Clock = memo(function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = tickAlignedToSecond(() => {
        setNow(new Date());
        schedule();
      });
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="px-5 py-6 text-center">
      <p className="font-semibold text-[#5A3E8A] dark:text-[#EBDFFF] leading-none tracking-[-2.5px]"
        style={{ fontFamily: "var(--font-display)", fontSize: "44px" }}>{timeStr}</p>
      <div className="flex justify-center items-center gap-1.5 mt-2">
        <Spark size={9} color="#B49FD0" cls="twinkle" />
        <p className="text-[11px] text-[#9685B0] dark:text-[#C8B8E0] font-medium">make a wish</p>
        <Spark size={9} color="#B49FD0" cls="twinkle2" />
      </div>
      <div className="flex justify-center items-center gap-3 mt-3">
        <span className="breathe text-[22px]">⭐</span>
        <div className="float"><Bow size={22} color="#D0B8EA" /></div>
        <span className="breathe2 text-[22px]">⭐</span>
      </div>
    </div>
  );
});

export default Clock;
