"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { KitActions } from "@/lib/kit-editor";
import { CATEGORIES, isProtected, type Question, type QuestionCategory, type Requirement } from "@/lib/types";
import { Badge } from "../ui/primitives";
import { EditableText } from "./editable-text";
import { PinButton, ProvenanceBadges } from "./provenance";

interface QuestionListProps {
  category: QuestionCategory;
  questions: Question[];
  requirements: Requirement[];
  actions: KitActions;
  /** This category is being regenerated right now. */
  regenerating: boolean;
  /** The question a link pointed at, shown with a ring. */
  highlightId?: string;
  onDelete(question: Question): void;
}

const selectClass = "h-8 rounded-md border border-slate-300 bg-surface px-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/**
 * One category's questions, reorderable by mouse, touch or keyboard (focus the handle, Space to
 * pick up, arrows to move, Space to drop; the library announces each step to screen readers).
 */
export function QuestionList({ category, questions, requirements, actions, regenerating, highlightId, onDelete }: QuestionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = questions.map((question) => question.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    actions.reorderQuestions(category, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              position={index + 1}
              total={questions.length}
              requirements={requirements}
              actions={actions}
              beingReplaced={regenerating && !isProtected(question)}
              highlighted={question.id === highlightId}
              onDelete={() => onDelete(question)}
              onStep={(delta) => actions.reorderQuestions(category, arrayMove(ids, index, index + delta))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

interface QuestionItemProps {
  question: Question;
  position: number;
  total: number;
  requirements: Requirement[];
  actions: KitActions;
  beingReplaced: boolean;
  highlighted: boolean;
  onDelete(): void;
  onStep(delta: -1 | 1): void;
}

function QuestionItem({ question, position, total, requirements, actions, beingReplaced, highlighted, onDelete, onStep }: QuestionItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const covered = requirements.filter((requirement) => question.requirement_ids.includes(requirement.id));
  const name = `question ${position} of ${total}`;

  return (
    <li
      id={`question-${question.id}`}
      data-highlighted={highlighted || undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("scroll-mt-32 rounded-2xl border bg-surface transition-shadow", highlighted && "ring-2 ring-indigo-400", isDragging ? "relative z-10 border-indigo-400 shadow-lift" : "border-slate-200/80 shadow-card", beingReplaced && "opacity-60")}
    >
      <div className="flex gap-2 p-3">
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}. Press Space, then the arrow keys.`}
            className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 active:cursor-grabbing"
          >
            <svg viewBox="0 0 16 24" className="h-5 w-4" fill="currentColor" aria-hidden="true">
              {[6, 12, 18].flatMap((y) => [4, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <EditableText required label={`Prompt of ${name}`} value={question.prompt} maxLength={2000} onChange={(prompt) => actions.editQuestion(question.id, { prompt })} className="font-medium text-slate-900" />
          <EditableText
            label={`Answer outline of ${name}`}
            value={question.answer_outline}
            maxLength={6000}
            placeholder="Outline a strong answer..."
            onChange={(answer_outline) => actions.editQuestion(question.id, { answer_outline })}
            className="text-sm text-slate-700"
          />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1">
            <ProvenanceBadges item={question} />
            {covered.map((requirement) => (
              <Badge key={requirement.id} tone={requirement.priority === "must" ? "red" : "neutral"} title={`${requirement.priority === "must" ? "Must-have" : "Nice-to-have"}: ${requirement.text}`}>
                {requirement.id} · {requirement.text.length > 28 ? `${requirement.text.slice(0, 26)}...` : requirement.text}
              </Badge>
            ))}
            {beingReplaced && <span className="text-xs text-slate-600">Being replaced. Edit or pin it to keep it.</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Difficulty
              <select className={selectClass} value={question.difficulty} onChange={(event) => actions.setDifficulty(question.id, Number(event.target.value))}>
                <option value={1}>1 · Warm-up</option>
                <option value={2}>2 · Standard</option>
                <option value={3}>3 · Hard</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Category
              <select className={selectClass} value={question.category} onChange={(event) => actions.moveQuestion(question.id, event.target.value as QuestionCategory, Number.MAX_SAFE_INTEGER)}>
                {CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="ml-auto flex items-center gap-0.5">
              <IconButton label={`Move ${name} up`} disabled={position === 1} onClick={() => onStep(-1)} path="M6 15l6-6 6 6" />
              <IconButton label={`Move ${name} down`} disabled={position === total} onClick={() => onStep(1)} path="M6 9l6 6 6-6" />
              <PinButton pinned={Boolean(question.pinned)} what={name} onToggle={() => actions.pin({ kind: "question", id: question.id }, !question.pinned)} />
              <IconButton label={`Delete ${name}`} onClick={onDelete} path="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" danger />
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

export function IconButton({ label, path, onClick, disabled, danger }: { label: string; path: string; onClick(): void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-slate-100 hover:text-slate-800",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}
