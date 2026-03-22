import type { Person } from "@/types/family";
import { Users, Phone, ChevronDown, ChevronRight, Cake } from "lucide-react";
import { useState } from "react";
import { cn, calculateAge } from "@/lib/utils";

interface ReadOnlyPersonCardProps {
  person: Person;
  depth?: number;
  getSpouses: (personId: string) => Person[];
  getChildren: (personId: string) => Person[];
}

export function ReadOnlyPersonCard({ person, depth = 0, getSpouses, getChildren }: ReadOnlyPersonCardProps) {
  const [expandLevel, setExpandLevel] = useState<0 | 1 | 2>(2);

  const spouses = getSpouses(person.id);
  const children = getChildren(person.id);
  const hasChildren = children.length > 0;
  const isMale = person.gender === "L";

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
    setExpandLevel((prev) => {
      if (prev === 2) return 1;
      if (prev === 1) return hasChildren ? 0 : 2;
      return 2;
    });
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
              "rounded-xl border bg-card p-3 sm:p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-pointer w-full overflow-hidden",
              isMale ? "border-l-[4px] border-l-family-male" : "border-l-[4px] border-l-family-female"
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
          </div>
        </div>
      </div>

      {hasChildren && expandLevel > 0 && (
        <div className="relative mt-2 ml-2 pl-2 sm:ml-6 sm:pl-4 border-l-2 border-slate-300 space-y-4 pb-2">
          {children.map((child) => (
            <ReadOnlyPersonCard
              key={child.id}
              person={child}
              depth={depth + 1}
              getSpouses={getSpouses}
              getChildren={getChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}
