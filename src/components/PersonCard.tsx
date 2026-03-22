import type { Person } from "@/types/family";
import { useFamilyStore } from "@/store/familyStore";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Phone, ChevronDown, ChevronRight, Cake, Pencil, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";
import { cn, calculateAge } from "@/lib/utils";
import { Tooltip } from "@/components/ui/simple-tooltip";

interface PersonCardProps {
  person: Person;
  depth?: number;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onAddSpouse: (personId: string) => void;
  onAddChild: (personId: string) => void;
  onAddSibling: (personId: string) => void;
  onEdit: (personId: string) => void;
  onDelete: (personId: string) => void;
}

export function PersonCard({ person, depth = 0, isSelected, onSelect, onAddSpouse, onAddChild, onAddSibling, onEdit, onDelete }: PersonCardProps) {
  const { getSpouses, getChildren, reorderChildren } = useFamilyStore();
  const [expandLevel, setExpandLevel] = useState<0 | 1 | 2>(2);
  const [draggedChildId, setDraggedChildId] = useState<string | null>(null);

  const spouses = getSpouses(person.id);
  const children = getChildren(person.id);
  const hasChildren = children.length > 0;
  const isMale = person.gender === "L";
  const canAddSpouse = isMale ? spouses.length < 4 : spouses.length === 0;
  const spouseLabel = isMale ? "Tambah Istri" : "Tambah Suami";
  
  const hasGrandchildren = children.some(child => getChildren(child.id).length > 0);
  const personIcon = hasGrandchildren ? (isMale ? "👴" : "👵") : (isMale ? "👨" : "👩");
  const childrenPreview = children
    .slice(0, 3)
    .map((child) => child.full_name)
    .join(", ");
  const collapsedChildrenLabel =
    children.length > 3 ? `${childrenPreview}, +${children.length - 3} lagi` : childrenPreview;

  const age = calculateAge(person.birth_date);

  const handleCardClick = () => {
    if (onSelect) onSelect(person.id);
    setExpandLevel((prev) => {
      if (prev === 2) return 1;
      if (prev === 1) return hasChildren ? 0 : 2;
      return 2;
    });
  };

  const handleDropOnChild = (targetChildId: string) => {
    if (!draggedChildId || draggedChildId === targetChildId) {
      setDraggedChildId(null);
      return;
    }

    reorderChildren(person.id, draggedChildId, targetChildId);
    setDraggedChildId(null);
  };

  return (
    <div className="animate-fade-in relative" id={`person-${person.id}`}>
      <div
        className={cn("flex items-stretch gap-2 relative")}
      >
        {/* Horizontal line to this node if depth > 0 */}
        {depth > 0 && (
          <div className="absolute -left-2 sm:-left-4 top-8 w-2 sm:w-4 border-t-2 border-slate-300" />
        )}

        <div className="flex flex-1 flex-col gap-2 z-10 w-full">
          <div
            className={cn(
              "rounded-xl border bg-card p-3 sm:p-3.5 shadow-sm transition-all cursor-pointer w-full overflow-hidden",
              isMale ? "border-l-[4px] border-l-family-male" : "border-l-[4px] border-l-family-female",
              isSelected ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:shadow-md"
            )}
            onClick={handleCardClick}
          >
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {hasChildren && (
                  <button
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground active:scale-95"
                  >
                    {expandLevel > 0 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}

                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-lg hidden sm:inline-block">{personIcon}</span>
                  <p className="truncate text-base font-semibold text-card-foreground">
                    {expandLevel === 0 && hasChildren
                      ? `${person.full_name} - Anak: ${collapsedChildrenLabel}`
                      : expandLevel < 2 && spouses.length > 0
                      ? `${person.full_name} & ${spouses.map((s) => s.full_name).join(", ")}`
                      : person.full_name}
                  </p>
                  {age !== null && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md whitespace-nowrap">
                      {age} thn
                    </span>
                  )}
                </div>
              </div>

              {expandLevel === 2 && (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="Edit Data">
                    <button
                      onClick={() => onEdit(person.id)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Hapus Anggota">
                    <button
                      onClick={() => onDelete(person.id)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 active:scale-95 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>

            {expandLevel === 2 && (
              <div className={cn("mt-4 grid gap-4", spouses.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-2.5">
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {person.birth_date && (
                      <div className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{new Date(person.birth_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                    )}
                    {person.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{person.phone_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {spouses.length > 0 && (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/30 p-3 h-full flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {isMale ? "Istri" : "Suami"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {spouses.map(spouse => (
                          <div key={spouse.id} className="flex items-center gap-2">
                            <span className="text-lg">{spouse.gender === "L" ? "👨" : "👩"}</span>
                            <span className="font-medium text-sm truncate">{spouse.full_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {expandLevel === 2 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                {canAddSpouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddSpouse(person.id)}
                    className="text-xs w-full sm:w-auto"
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    {spouseLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddSibling(person.id)}
                  className="text-xs w-full sm:w-auto"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Tambah Saudara
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAddChild(person.id)}
                  className="text-xs w-full sm:w-auto"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Tambah Anak
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expandLevel > 0 && (
        <div className="relative mt-2 ml-2 pl-2 sm:ml-6 sm:pl-4 border-l-2 border-slate-300 space-y-4 pb-2">
          {children.map((child) => (
            <div
              key={child.id}
              draggable
              onDragStart={() => setDraggedChildId(child.id)}
              onDragEnd={() => setDraggedChildId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDropOnChild(child.id);
              }}
              className={cn("relative", draggedChildId === child.id && "opacity-60")}
            >
              <div className="absolute -left-2 top-6 z-20 rounded bg-background/80 p-0.5 text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <PersonCard
                person={child}
                depth={depth + 1}
                isSelected={isSelected}
                onSelect={onSelect}
                onAddSpouse={onAddSpouse}
                onAddChild={onAddChild}
                onAddSibling={onAddSibling}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
