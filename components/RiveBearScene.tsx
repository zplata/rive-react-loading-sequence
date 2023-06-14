import {
  Artboard,
  StateMachineInstance,
  CanvasRenderer,
  RiveCanvas as RiveCanvasType,
  File,
  SMIInput,
} from "@rive-app/canvas-advanced";
import { RuntimeLoader, Layout, Fit, Alignment } from "@rive-app/react-canvas";

interface EngineOptions {
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
}

interface BearInstance {
  artboard: Artboard;
  stateMachine: StateMachineInstance;
  walkType: SMIInput;
  xPosition: number;
}

export default class RiveBearScene {
  private lastTime = 0;
  private canvas: HTMLCanvasElement;
  private container: HTMLDivElement;
  private rive!: RiveCanvasType;
  private renderer!: CanvasRenderer;
  private file!: File;
  private cleanup!: (() => void) | null;
  private lastWidth = 0;
  private lastHeight = 0;

  private bearSets: Set<BearInstance> = new Set();

  private forestFile!: File;
  private forestArtboard!: Artboard;
  private forestSM!: StateMachineInstance;

  private layout!: Layout;

  constructor({ canvas, container }: EngineOptions) {
    this.canvas = canvas;
    this.container = container;
  }

  async init() {
    this.rive = (await RuntimeLoader.awaitInstance()) as RiveCanvasType;
    this.renderer = this.rive.makeRenderer(this.canvas) as CanvasRenderer;
    const bytes = await (
      await fetch(new Request("/walk_cycles.riv"))
    ).arrayBuffer();
    const forestBytes = await (
      await fetch(new Request("/forest.riv"))
    ).arrayBuffer();
    this.file = (await this.rive.load(new Uint8Array(bytes))) as File;
    this.forestFile = (await this.rive.load(
      new Uint8Array(forestBytes)
    )) as File;
    this.forestArtboard = this.forestFile.artboardByName(
      "New Artboard"
    ) as Artboard;
    this.forestSM = new this.rive.StateMachineInstance(
      this.forestArtboard.stateMachineByName("State Machine 1"),
      this.forestArtboard
    ) as StateMachineInstance;
    const initialArtboard = this.file.artboardByName(
      "Different Walks Main"
    ) as Artboard;
    const initialStateMachine = new this.rive.StateMachineInstance(
      initialArtboard.stateMachineByName("State Machine 1"),
      initialArtboard
    ) as StateMachineInstance;
    let walkType: SMIInput;
    for (let i = 0; i < initialStateMachine.inputCount(); i++) {
      const input = initialStateMachine.input(i);
      if (input.name === "walkType") {
        walkType = input.asNumber() as SMIInput;
        walkType.value = 0;
      }
    }

    this.bearSets.add({
      artboard: initialArtboard,
      stateMachine: initialStateMachine,
      walkType: walkType!,
      xPosition: -550,
    });

    this.resizeDrawingSurfaceToCanvas();

    const containerWidth = this.container.clientWidth;

    this.layout = new Layout({
      fit: Fit.Contain,
      alignment: Alignment.BottomLeft,
      maxX: this.canvas.width,
      maxY: this.canvas.height,
    });
    this.resizeAndResetLayout();
  }

  reset() {
    this.renderer?.delete();
    this.file.delete();
    if (this.cleanup) {
      this.cleanup();
    }
  }

  resizeDrawingSurfaceToCanvas() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = dpr * width;
    this.canvas.height = dpr * height;
  }

  addBear() {
    const artboard = this.file.artboardByName(
      "Different Walks Main"
    ) as Artboard;
    const sm = new this.rive.StateMachineInstance(
      artboard.stateMachineByName("State Machine 1"),
      artboard
    ) as StateMachineInstance;
    let walkType: SMIInput;
    for (let i = 0; i < sm.inputCount(); i++) {
      const input = sm.input(i);
      if (input.name === "walkType") {
        walkType = input.asNumber() as SMIInput;
        walkType.value = Math.floor(Math.random() * 6);
      }
    }
    this.bearSets.add({
      artboard,
      stateMachine: sm,
      walkType: walkType!,
      xPosition: -550,
    });
  }

  animateAsset({
    elapsedTimeSec,
    isVisible = true,
    bear,
  }: {
    elapsedTimeSec: number;
    isVisible?: boolean;
    bear: BearInstance;
  }) {
    const { artboard, stateMachine, xPosition } = bear;
    stateMachine.advance(elapsedTimeSec);

    // Advance the artboard
    artboard.advance(elapsedTimeSec);

    const tempLayout = this.layout.copyWith({
      minY: this.canvas.height - 300,
      maxY: this.canvas.height,
    });
    // Align artboard in renderer canvas
    this.alignArtboard(artboard, bear, isVisible, tempLayout);
  }

  animateForest(elapsedTimeSec: number) {
    this.forestSM.advance(elapsedTimeSec);
    this.forestArtboard.advance(elapsedTimeSec);
    const tempLayout = this.layout.copyWith({
      fit: Fit.Cover,
      alignment: Alignment.BottomCenter,
    });
    this.alignArtboard(this.forestArtboard, undefined, true, tempLayout);
  }

  alignArtboard(
    artboard: Artboard,
    bear?: BearInstance,
    isVisible?: boolean,
    layout?: Layout
  ) {
    this.renderer.save();
    this.renderer.align(
      (layout ? layout : this.layout).runtimeFit(this.rive),
      (layout ? layout : this.layout).runtimeAlignment(this.rive),
      {
        minX: this.layout.minX,
        minY: (layout ? layout : this.layout).minY,
        maxX: this.layout.maxX,
        maxY: (layout ? layout : this.layout).maxY,
      },
      artboard.bounds
    );
    if (bear) {
      bear.xPosition += 5;
      this.renderer.translate(bear.xPosition, 0);
    }
    if (isVisible) {
      artboard.draw(this.renderer);
    }
    this.renderer.restore();
  }

  clearOffscreenBears() {
    const bearsToRemove: BearInstance[] = [];
    this.bearSets.forEach((bear, idx) => {
      if (bear.xPosition > this.canvas.width * 2) {
        bear.artboard.delete();
        bear.stateMachine.delete();
        bear.xPosition = -1;
        bearsToRemove.push(bear);
      }
    });
    bearsToRemove.forEach((bear) => this.bearSets.delete(bear));
  }

  throttle(f: Function, delay: number) {
    let timer = 0;
    return function (this: Function, ...args: any) {
      clearTimeout(timer);
      timer = window.setTimeout(() => f.apply(this, args), delay);
    };
  }

  resizeAndResetLayout() {
    if (this.canvas && this.container) {
      const resizeObserver = new ResizeObserver(
        this.throttle(() => {
          if (this.rive) {
            const newWidth = this.container.clientWidth;
            const newHeight = this.container.clientHeight;
            if (this.lastWidth !== newWidth || this.lastHeight !== newHeight) {
              const dpr = window.devicePixelRatio;
              const newCanvasWidth = dpr * newWidth;
              const newCanvasHeight = dpr * newHeight;
              this.canvas.width = newCanvasWidth;
              this.canvas.height = newCanvasHeight;
              this.lastWidth = newCanvasWidth;
              this.lastHeight = newCanvasHeight;
              this.canvas.style.width = `${newWidth}px`;
              this.canvas.style.height = `${newHeight}px`;

              // resize to canvas
              this.layout = this.layout.copyWith({
                fit: Fit.Contain,
                minX: 0,
                minY: 0,
                maxX: this.canvas.width,
                maxY: this.canvas.height,
              });
              // start rendering
            }
          }
        }, 0)
      );
      resizeObserver.observe(this.container, { box: "border-box" });
    }
  }

  async run() {
    // This loop runs continuously until the engine is stopped
    const renderLoop = (time: number) => {
      if (!this.lastTime) {
        this.lastTime = time;
      }
      const elapsedTimeMs = time - this.lastTime;
      const elapsedTimeSec = elapsedTimeMs / 1000;
      this.lastTime = time;

      // Important: reset render loop
      this.renderer.clear();

      this.animateForest(elapsedTimeSec);

      this.bearSets.forEach((bear) => {
        // All base layers are animated together
        this.animateAsset({
          elapsedTimeSec,
          isVisible: true,
          bear,
        });
      });

      this.clearOffscreenBears();

      // Start new loop
      this.rive.requestAnimationFrame(renderLoop);
    };
    this.rive.requestAnimationFrame(renderLoop);
  }
}
