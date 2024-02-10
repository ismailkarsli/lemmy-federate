interface FetchError {
  message: string;
  status: number;
  data: {
    statusCode: number;
    statusMessage: string;
    message: string;
  };
}
export const isFetchError = (error: unknown): error is FetchError => {
  return (
    error instanceof Error &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "data" in error
  );
};
