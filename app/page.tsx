"use client";
import { LoadingTextCentered } from "@/components/LoadingText";
import RiveBearScene from "@/components/RiveBearScene";
import { setRandomInterval } from "@/utils/setRandomInterval";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [pct, setPct] = useState(0);
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);

  const [bearScene, setBearScene] = useState<RiveBearScene>();

  useEffect(() => {
    let currentProgress = 0;
    let step = 0.2;
    const interval = setInterval(function () {
      currentProgress += step;
      let progress =
        Math.round((Math.atan(currentProgress) / (Math.PI / 2)) * 100 * 1000) /
        1000;
      if (progress >= 100) {
        clearInterval(interval);
      } else if (progress >= 70) {
        step = 0.1;
      }
      setPct(progress);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!bearScene && canvasRef.current && canvasContainerRef.current) {
      const createBScene = async () => {
        const bScene = new RiveBearScene({
          canvas: canvasRef.current!,
          container: canvasContainerRef.current!,
        });
        await bScene.init();
        bScene.run();
        setRandomInterval(
          () => {
            bScene.addBear();
          },
          1000,
          3500
        );
        setBearScene(bScene);
      };
      createBScene();
    }
  }, [bearScene, canvasRef, canvasContainerRef]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <LoadingTextCentered percentage={pct} />
      <div
        className="absolute bottom-0 h-full bg-white w-full"
        ref={canvasContainerRef}
      >
        <canvas ref={canvasRef}></canvas>
      </div>
    </main>
  );
}
