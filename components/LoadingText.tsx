interface LoadingTextProps {
  percentage: number | undefined;
}

export const LoadingTextCentered = ({ percentage }: LoadingTextProps) => (
  <div className="z-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
    <h1
      className="text-white text-4xl lg:text-5xl pb-2"
      style={{ textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)" }}
    >
      Bear with us
    </h1>
    <h2
      className="text-white text-3xl lg:text-4xl pb-2"
      style={{ textShadow: "1px 1px 1px rgba(0, 0, 0, 0.5)" }}
    >
      {percentage
        ? `Loading ${percentage.toString().substring(0, 2)}%`
        : "Loading..."}
    </h2>
  </div>
);
