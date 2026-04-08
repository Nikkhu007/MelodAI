export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-surface-raised/60 border border-surface-border/30 p-3 animate-pulse">
      <div className="aspect-square rounded-xl bg-surface-overlay mb-3" />
      <div className="h-3.5 bg-surface-overlay rounded-full mb-2 w-4/5" />
      <div className="h-3 bg-surface-overlay rounded-full w-3/5" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-8 h-3 bg-surface-overlay rounded" />
      <div className="w-10 h-10 rounded-lg bg-surface-overlay shrink-0" />
      <div className="flex-1">
        <div className="h-3 bg-surface-overlay rounded-full mb-2 w-3/5" />
        <div className="h-2.5 bg-surface-overlay rounded-full w-2/5" />
      </div>
      <div className="w-8 h-2.5 bg-surface-overlay rounded" />
    </div>
  )
}

export function SkeletonText({ className = '' }) {
  return <div className={`bg-surface-overlay animate-pulse rounded-full ${className}`} />
}
