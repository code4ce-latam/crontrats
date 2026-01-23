export default function Loading() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col gap-2 items-start">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted mb-4" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div>
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted mb-4" />
        <div className="space-y-2">
          <div className="h-6 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-6 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

