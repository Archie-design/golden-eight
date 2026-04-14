'use client'

import { useDraggable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface TagLike { id?: string; name?: string; tag_name?: string; color: string; emoji?: string | null }

interface TagPillProps {
  id: string
  tag: TagLike
  variant: 'library' | 'block' | 'overlay'
  // block-only
  sourceBlockIdx?: number
  sourceTagIdx?: number
}

// ── Library pill (draggable source from the tag panel) ───────────────────────
function LibraryTagPill({ id, tag }: { id: string; tag: TagLike }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'library-tag', tag },
  })
  const label = tag.emoji ? `${tag.emoji} ${tag.tag_name ?? tag.name}` : (tag.tag_name ?? tag.name)
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-white select-none',
        'cursor-grab active:cursor-grabbing transition-opacity touch-none',
        isDragging && 'opacity-40 ring-2 ring-amber-400/60'
      )}
      style={{ background: tag.color }}
    >
      {label}
    </span>
  )
}

// ── Block pill (sortable within a block, draggable to other blocks) ───────────
function BlockTagPill({
  id, tag, sourceBlockIdx, sourceTagIdx,
}: {
  id: string; tag: TagLike; sourceBlockIdx: number; sourceTagIdx: number
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id,
    data: { type: 'block-tag', tag, sourceBlockIdx, sourceTagIdx },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: tag.color,
  }
  const label = tag.emoji ? `${tag.emoji} ${tag.name ?? tag.tag_name}` : (tag.name ?? tag.tag_name)
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-white select-none',
        'cursor-grab active:cursor-grabbing transition-opacity touch-none',
        isDragging && 'opacity-40 ring-2 ring-amber-400/60'
      )}
    >
      {label}
    </span>
  )
}

// ── Overlay pill (floating clone while dragging) ─────────────────────────────
function OverlayTagPill({ tag }: { tag: TagLike }) {
  const label = tag.emoji
    ? `${tag.emoji} ${tag.name ?? tag.tag_name}`
    : (tag.name ?? tag.tag_name)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-white shadow-lg scale-105 rotate-2 ring-2 ring-amber-500 select-none pointer-events-none"
      style={{ background: tag.color }}
    >
      {label}
    </span>
  )
}

// ── Public API ───────────────────────────────────────────────────────────────
export function TagPill({ id, tag, variant, sourceBlockIdx, sourceTagIdx }: TagPillProps) {
  if (variant === 'library') return <LibraryTagPill id={id} tag={tag} />
  if (variant === 'overlay') return <OverlayTagPill tag={tag} />
  return (
    <BlockTagPill
      id={id}
      tag={tag}
      sourceBlockIdx={sourceBlockIdx ?? 0}
      sourceTagIdx={sourceTagIdx ?? 0}
    />
  )
}
