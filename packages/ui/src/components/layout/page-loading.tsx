import { Skeleton } from "../ui/skeleton";

export function PageLoading() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
