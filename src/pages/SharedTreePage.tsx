import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import { TreePine, Loader2, Search } from "lucide-react";
import type { Person, Relationship } from "@/types/family";
import { ReadOnlyPersonCard } from "@/components/ReadOnlyPersonCard";
import { FamilyTreeGraph } from "@/components/FamilyTreeGraph";

interface SharedData {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function SharedTreePage() {
  const { id } = useParams<{ id: string }>();
  const [parsed, setParsed] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'list' | 'hierarchical' | 'radial' | 'organic'>('list');

  useEffect(() => {
    let cancelled = false;

    async function loadData(isInitialLoad = false) {
      if (!id) {
        if (isInitialLoad) {
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/trees/${id}`, { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as SharedData;
          if (cancelled) return;

          setParsed((prev) => {
            const prevVersion = prev?.updatedAt ?? prev?.createdAt ?? null;
            const nextVersion = json.updatedAt ?? json.createdAt ?? null;
            if (prevVersion && nextVersion && prevVersion === nextVersion) {
              return prev;
            }
            return json;
          });
        }
      } catch (e) {
        console.error("Failed to fetch shared tree", e);
      }

      if (isInitialLoad && !cancelled) {
        setLoading(false);
      }
    }

    void loadData(true);

    const intervalId = setInterval(() => {
      void loadData(false);
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [id]);

  useEffect(() => {
    if (parsed && parsed.rootPersonId) {
      const rootPerson = parsed.persons.find((p) => p.id === parsed.rootPersonId);
      if (rootPerson) {
        document.title = `Keluarga ${rootPerson.full_name} - ${parsed.persons.length} Anggota keluarga`;
      }
    }
  }, [parsed]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-muted-foreground">Memuat silsilah keluarga...</p>
      </div>
    );
  }

  if (!parsed || !parsed.rootPersonId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <TreePine className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Link tidak valid</h1>
        <p className="text-muted-foreground">Data silsilah keluarga tidak ditemukan.</p>
        <Link to="/" className="text-sm font-medium text-primary underline">
          Buat silsilah sendiri →
        </Link>
      </div>
    );
  }

  const rootPerson = parsed.persons.find((p) => p.id === parsed.rootPersonId);
  if (!rootPerson) return null;

  const getSpouses = (personId: string): Person[] => {
    const rels = parsed.relationships.filter(
      (r) => (r.type === "spouse" || r.type === "partner") && (r.source_person_id === personId || r.target_person_id === personId)
    );
    const spouseIds = rels.map(r => r.source_person_id === personId ? r.target_person_id : r.source_person_id);
    return parsed.persons.filter((p) => spouseIds.includes(p.id));
  };

  const getChildren = (personId: string): Person[] => {
    const childRels = parsed.relationships
      .filter((r) => r.type === "parent_child" && r.source_person_id === personId)
      .sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    return childRels
      .map((rel) => parsed.persons.find((p) => p.id === rel.target_person_id))
      .filter(Boolean) as Person[];
  };

  const searchResults = parsed.persons.filter(p => 
    searchQuery && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchResultClick = (personId: string) => {
    setSearchQuery("");
    setShowSearchResults(false);
    setTimeout(() => {
      const el = document.getElementById(`person-${personId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
        }, 2000);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex flex-col sm:flex-row min-h-14 py-2 sm:py-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <TreePine className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Family QuickTree</h1>
            </div>
            <span className="sm:hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          </div>

          <div className="relative w-full sm:max-w-xs flex-1 order-3 sm:order-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama anggota keluarga..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              />
            </div>
            {showSearchResults && searchQuery && (
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md z-50 max-h-60 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map(p => (
                    <div 
                      key={p.id} 
                      className="px-4 py-2 text-sm hover:bg-muted cursor-pointer"
                      onClick={() => handleSearchResultClick(p.id)}
                    >
                      {p.full_name}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-muted-foreground">Tidak ditemukan</div>
                )}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto justify-end order-2 sm:order-3">
            <select 
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as 'list' | 'hierarchical' | 'radial' | 'organic')}
            >
              <option value="list">List View</option>
              <option value="hierarchical">Hierarchical</option>
              <option value="radial">Radial</option>
              <option value="organic">Organic</option>
            </select>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {parsed.persons.length} anggota keluarga
          </p>
          <div className="sm:hidden">
            <select 
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as 'list' | 'hierarchical' | 'radial' | 'organic')}
            >
              <option value="list">List View</option>
              <option value="hierarchical">Hierarchical</option>
              <option value="radial">Radial</option>
              <option value="organic">Organic</option>
            </select>
          </div>
        </div>
        {layoutMode === 'list' ? (
          <ReadOnlyPersonCard
            person={rootPerson}
            getSpouses={getSpouses}
            getChildren={getChildren}
          />
        ) : (
          <FamilyTreeGraph 
            persons={parsed.persons} 
            relationships={parsed.relationships} 
            layout={layoutMode} 
          />
        )}
        <div className="mt-8 text-center">
          <Link to="/" className="text-sm font-medium text-primary underline">
            Buat silsilah keluarga sendiri →
          </Link>
        </div>
      </main>
    </div>
  );
}
