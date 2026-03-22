import { useFamilyStore } from "@/store/familyStore";
import { PersonCard } from "@/components/PersonCard";
import { FamilyTreeGraph } from "@/components/FamilyTreeGraph";
import { Button } from "@/components/ui/button";
import { AddPersonForm } from "@/components/AddPersonForm";
import { Share2, TreePine, RotateCcw, Loader2, Undo2, Redo2, Search, Save, History, Trash2, RotateCcwSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PersonFormData, Gender, Person, Relationship } from "@/types/family";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ModalMode =
  | { type: "idle" }
  | { type: "add_root" }
  | { type: "add_spouse"; personId: string; defaultGender: Gender }
  | { type: "add_child"; parentId: string }
  | { type: "add_sibling"; personId: string; defaultGender: Gender }
  | { type: "edit"; person: Person; disableGender: boolean }
  | { type: "delete_confirm"; personId: string; personName: string }
  | { type: "reset_confirm" }
  | { type: "share"; readOnlyUrl: string; editorUrl: string }
  | { type: "snapshots" };

interface SharedTreePayload {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
}

interface ShareResponse {
  id: string;
  editKey: string;
}

export default function FamilyTreePage() {
  const {
    persons,
    relationships,
    rootPersonId,
    past,
    future,
    snapshots,
    addPerson,
    updatePerson,
    addRelationship,
    setRoot,
    reset,
    getPerson,
    removePersonRecursive,
    undo,
    redo,
    countSpouses,
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
  } = useFamilyStore();

  const [modal, setModal] = useState<ModalMode>({ type: "idle" });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'list' | 'hierarchical' | 'radial' | 'organic'>('list');
  const rootPerson = rootPersonId ? getPerson(rootPersonId) : undefined;
  
  const searchResults = persons.filter(p => 
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

  const { id, editKey } = useParams();
  const navigate = useNavigate();
  const isSyncing = useRef(false);

  useEffect(() => {
    if (id && editKey) {
      setIsLoading(true);
      fetch(`/api/trees/${id}`)
        .then(res => {
          if (!res.ok) throw new Error("Not found");
          return res.json() as Promise<SharedTreePayload>;
        })
        .then(data => {
          // Temporarily disable syncing while loading
          isSyncing.current = true;
          reset();
          
          // Re-add all data
          if (data.persons) {
            useFamilyStore.setState({
              persons: data.persons,
              relationships: data.relationships,
              rootPersonId: data.rootPersonId
            });
          }
          
          // We don't want to stay on the URL with editKey for security if they copy it,
          // but actually we do, so they can bookmark it.
          // Let's just keep them on this URL.
          toast.success("Berhasil memuat silsilah untuk diedit!");
        })
        .catch(err => {
          console.error(err);
          toast.error("Gagal memuat silsilah atau link tidak valid.");
          navigate("/");
        })
        .finally(() => {
          setIsLoading(false);
          // Allow syncing after a short delay to prevent initial load from triggering a save
          setTimeout(() => {
            isSyncing.current = false;
          }, 500);
        });
    }
  }, [id, editKey, navigate, reset]);

  // Sync changes back to server if we are in edit mode
  useEffect(() => {
    if (id && editKey && !isSyncing.current && persons.length > 0) {
      const syncData = async () => {
        try {
          await fetch(`/api/trees/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              editKey,
              treeData: { persons, relationships, rootPersonId }
            })
          });
        } catch (error) {
          console.error("Failed to sync changes", error);
        }
      };
      
      const timeoutId = setTimeout(syncData, 1000); // Debounce saves
      return () => clearTimeout(timeoutId);
    }
  }, [persons, relationships, rootPersonId, id, editKey]);

  useEffect(() => {
    if (rootPerson) {
      document.title = `Keluarga ${rootPerson.full_name} - ${persons.length} Anggota keluarga`;
    } else {
      document.title = "Family QuickTree";
    }
  }, [rootPerson, persons.length]);

  const handleAddRoot = (data: PersonFormData) => {
    const person = addPerson({
      full_name: data.full_name,
      gender: data.gender,
      phone_number: data.phone_number,
      birth_date: data.birth_date,
    });
    setRoot(person.id);
    setModal({ type: "idle" });
  };

  const handleAddSpouse = (data: PersonFormData, personId: string) => {
    const spouse = addPerson({
      full_name: data.full_name,
      gender: data.gender,
      phone_number: data.phone_number,
      birth_date: data.birth_date,
    });
    addRelationship("spouse", personId, spouse.id);
    setModal({ type: "idle" });
  };

  const handleAddChild = (data: PersonFormData, parentId: string, secondParentId?: string) => {
    const child = addPerson({
      full_name: data.full_name,
      gender: data.gender,
      phone_number: data.phone_number,
      birth_date: data.birth_date,
    });
    addRelationship("parent_child", parentId, child.id);
    if (secondParentId) {
      addRelationship("parent_child", secondParentId, child.id);
    }
    setModal({ type: "idle" });
  };

  const handleAddSibling = (data: PersonFormData, personId: string) => {
    const sibling = addPerson({
      full_name: data.full_name,
      gender: data.gender,
      phone_number: data.phone_number,
      birth_date: data.birth_date,
    });
    
    // Try to find parents of the current person
    const parents = relationships.filter(
      (r) => r.type === "parent_child" && r.target_person_id === personId
    );

    if (parents.length > 0) {
      // Link new sibling to the same parents
      parents.forEach((p) => {
        addRelationship("parent_child", p.source_person_id, sibling.id);
      });
      toast.success(`Berhasil menambahkan ${data.full_name} sebagai saudara (anak dari orang tua yang sama)`);
    } else {
      // Fallback to explicit sibling relationship
      addRelationship("sibling", personId, sibling.id);
      toast.success(`Berhasil menambahkan ${data.full_name} sebagai saudara`);
    }
    
    setModal({ type: "idle" });
  };

  const handleEdit = (data: PersonFormData, personId: string) => {
    updatePerson(personId, {
      full_name: data.full_name,
      gender: data.gender,
      phone_number: data.phone_number || null,
      birth_date: data.birth_date || null,
    });
    toast.success("Data berhasil diperbarui");
    setModal({ type: "idle" });
  };

  const handleDelete = (personId: string) => {
    const person = getPerson(personId);
    if (person) {
      setModal({ type: "delete_confirm", personId, personName: person.full_name });
    }
  };

  const confirmDelete = (personId: string) => {
    removePersonRecursive(personId);
    toast.success("Berhasil dihapus");
    setModal({ type: "idle" });
  };

  const handleAddSpouseClick = (personId: string) => {
    const person = getPerson(personId);
    if (!person) return;
    
    // If male, can have up to 4 spouses. If female, only 1.
    const spouseCount = countSpouses(personId);
    if (person.gender === 'L' && spouseCount >= 4) {
      toast.error("Maksimal 4 istri");
      return;
    }
    if (person.gender === 'P' && spouseCount >= 1) {
      toast.error("Maksimal 1 suami");
      return;
    }

    const defaultGender: Gender = person.gender === "L" ? "P" : "L";
    setModal({ type: "add_spouse", personId, defaultGender });
  };

  const handleAddSiblingClick = (personId: string) => {
    const person = getPerson(personId);
    const defaultGender: Gender = person?.gender === "L" ? "L" : "P";
    setModal({ type: "add_sibling", personId, defaultGender });
  };

  const handleEditClick = (personId: string) => {
    const person = getPerson(personId);
    if (person) {
      // Check if person has a partner
      const hasPartner = relationships.some(
        (r) => (r.type === "partner" || r.type === "spouse") && (r.source_person_id === personId || r.target_person_id === personId)
      );
      setModal({ type: "edit", person, disableGender: hasPartner });
    }
  };

  const handleShare = async () => {
    if (id && editKey) {
      const readOnlyUrl = `${window.location.origin}/view/${id}`;
      const editorUrl = `${window.location.origin}/edit/${id}/${editKey}`;
      setModal({ type: "share", readOnlyUrl, editorUrl });
      return;
    }

    const data = { persons, relationships, rootPersonId };
    setIsSharing(true);
    try {
      const response = await fetch('/api/trees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error("Gagal mendapatkan link");
      
      const result = (await response.json()) as ShareResponse;
      const { id: newId, editKey: newEditKey } = result;
      
      const readOnlyUrl = `${window.location.origin}/view/${newId}`;
      const editorUrl = `${window.location.origin}/edit/${newId}/${newEditKey}`;

      // Redirect to the new edit URL so subsequent edits sync to this new tree
      navigate(`/edit/${newId}/${newEditKey}`, { replace: true });
      
      setModal({ type: "share", readOnlyUrl, editorUrl });
    } catch (error) {
      console.error("Share error:", error);
      toast.error("Gagal membuat link share. Coba lagi beberapa saat.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleReset = () => {
    setModal({ type: "reset_confirm" });
  };

  const confirmReset = () => {
    reset();
    if (id || editKey) {
      navigate("/");
    }
    setModal({ type: "idle" });
    toast.success("Data berhasil direset");
  };

  const modalTitle = (() => {
    switch (modal.type) {
      case "add_root": return "Tambah Data Diri";
      case "add_spouse": return "Tambah Pasangan (Suami/Istri)";
      case "add_child": return "Tambah Anak";
      case "add_sibling": return "Tambah Saudara";
      case "edit": return "Edit Data";
      case "delete_confirm": return "Konfirmasi Hapus";
      case "reset_confirm": return "Konfirmasi Reset";
      case "share": return "Bagikan Silsilah";
      case "snapshots": return "Riwayat Data";
      default: return "";
    }
  })();

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Link disalin ke clipboard!");
      });
    }
  };

  const shareToWA = (url: string) => {
    const message = encodeURIComponent(`Keluarga ${rootPerson?.full_name} - ${persons.length} Anggota keluarga\n\nLihat silsilah keluarga: ${url}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat silsilah keluarga...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex flex-col sm:flex-row min-h-14 py-2 sm:py-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <TreePine className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Family QuickTree</h1>
            </div>
            {persons.length > 0 && (
              <div className="flex gap-1 sm:hidden">
                <Button variant="outline" size="icon" onClick={undo} disabled={past.length === 0} className="h-8 w-8">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={redo} disabled={future.length === 0} className="h-8 w-8">
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setModal({ type: "snapshots" })} className="h-8 w-8">
                  <History className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {persons.length > 0 && (
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
          )}

          {persons.length > 0 && (
            <div className="flex gap-2 w-full sm:w-auto justify-end order-2 sm:order-3">
              <div className="hidden sm:flex gap-2">
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
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={undo} 
                  disabled={past.length === 0}
                  className="h-9 w-9"
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={redo} 
                  disabled={future.length === 0}
                  className="h-9 w-9"
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setModal({ type: "snapshots" })}
                  className="h-9 w-9"
                  title="Riwayat Data"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="whatsapp" size="sm" onClick={handleShare} disabled={isSharing} className="h-9">
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Share
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset} className="h-9 w-9" title="Reset">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container py-6">
        {!rootPerson ? (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center animate-fade-in">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <TreePine className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground" style={{ lineHeight: "1.2" }}>
              Mulai Silsilah Keluarga
            </h2>
            <p className="mb-8 max-w-xs text-muted-foreground">
              Tambahkan data diri Anda sebagai langkah pertama membangun pohon keluarga.
            </p>
            <Button size="lg" onClick={() => setModal({ type: "add_root" })}>
              Mulai Sekarang
            </Button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {persons.length} anggota keluarga
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
              <PersonCard
                person={rootPerson}
                isSelected={selectedPersonId === rootPerson.id}
                onSelect={setSelectedPersonId}
                onAddSpouse={handleAddSpouseClick}
                onAddChild={(id) => setModal({ type: "add_child", parentId: id })}
                onAddSibling={handleAddSiblingClick}
                onEdit={handleEditClick}
                onDelete={handleDelete}
              />
            ) : (
              <FamilyTreeGraph 
                persons={persons} 
                relationships={relationships} 
                layout={layoutMode} 
              />
            )}
          </div>
        )}
      </main>

      <Dialog
        open={modal.type !== "idle"}
        onOpenChange={(open) => !open && setModal({ type: "idle" })}
      >
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="sr-only">{modalTitle}</DialogTitle>
          </DialogHeader>
          {modal.type === "add_root" && (
            <AddPersonForm
              title={modalTitle}
              onSubmit={handleAddRoot}
              onCancel={() => setModal({ type: "idle" })}
            />
          )}
          {modal.type === "add_spouse" && (
            <AddPersonForm
              title={modalTitle}
              defaultGender={modal.defaultGender}
              disableGender={true}
              onSubmit={(data) => handleAddSpouse(data, modal.personId)}
              onCancel={() => setModal({ type: "idle" })}
            />
          )}
          {modal.type === "add_child" && (
            <AddPersonForm
              title={modalTitle}
              spouses={useFamilyStore.getState().getSpouses(modal.parentId)}
              onSubmit={(data, secondParentId) => handleAddChild(data, modal.parentId, secondParentId)}
              onCancel={() => setModal({ type: "idle" })}
            />
          )}
          {modal.type === "add_sibling" && (
            <AddPersonForm
              title={modalTitle}
              defaultGender={modal.defaultGender}
              onSubmit={(data) => handleAddSibling(data, modal.personId)}
              onCancel={() => setModal({ type: "idle" })}
            />
          )}
          {modal.type === "edit" && (
            <AddPersonForm
              title={modalTitle}
              initialData={modal.person}
              disableGender={modal.disableGender}
              onSubmit={(data) => handleEdit(data, modal.person.id)}
              onCancel={() => setModal({ type: "idle" })}
            />
          )}
          {modal.type === "delete_confirm" && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <p className="text-base font-medium">Hapus {modal.personName}?</p>
                <p className="text-sm text-muted-foreground">
                  Tindakan ini akan menghapus data anggota keluarga ini dan <strong>semua keturunannya</strong> secara permanen.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModal({ type: "idle" })}>Batal</Button>
                <Button variant="destructive" onClick={() => confirmDelete(modal.personId)}>Ya, Hapus</Button>
              </div>
            </div>
          )}
          {modal.type === "reset_confirm" && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <p className="text-base font-medium">Hapus Semua Data?</p>
                <p className="text-sm text-muted-foreground">
                  Tindakan ini akan menghapus <strong>seluruh data silsilah</strong> yang telah Anda buat secara permanen.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModal({ type: "idle" })}>Batal</Button>
                <Button variant="destructive" onClick={confirmReset}>Ya, Reset Semua</Button>
              </div>
            </div>
          )}
          {modal.type === "share" && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Link Read-Only (Hanya Lihat)</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={modal.readOnlyUrl} 
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(modal.readOnlyUrl)}>Copy</Button>
                    <Button variant="whatsapp" size="sm" onClick={() => shareToWA(modal.readOnlyUrl)}>WA</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gunakan link ini untuk membagikan silsilah tanpa akses edit.</p>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2 text-primary">Link Editor (Bisa Edit)</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={modal.editorUrl} 
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(modal.editorUrl)}>Copy</Button>
                    <Button variant="whatsapp" size="sm" onClick={() => shareToWA(modal.editorUrl)}>WA</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gunakan link ini untuk kolaborasi. Siapapun yang memiliki link ini dapat mengubah silsilah.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setModal({ type: "idle" })}>Tutup</Button>
              </div>
            </div>
          )}
          {modal.type === "snapshots" && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Snapshot Data Tersimpan</h3>
                  <Button variant="outline" size="sm" onClick={saveSnapshot}>
                    <Save className="h-4 w-4 mr-2" />
                    Simpan Snapshot
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simpan snapshot untuk menyimpan kondisi data saat ini. Anda dapat mengembalikan data ke snapshot sebelumnya kapan saja.
                </p>
                {snapshots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Belum ada snapshot tersimpan.</p>
                    <p className="text-xs mt-1">Klik "Simpan Snapshot" untuk menyimpan data saat ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {snapshots.slice().reverse().map((snapshot, index) => (
                      <div 
                        key={snapshot.createdAt} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {new Date(snapshot.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {snapshot.persons.length} anggota keluarga
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => restoreSnapshot(snapshot.createdAt)}
                            title="Pulihkan"
                          >
                            <RotateCcwSquare className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteSnapshot(snapshot.createdAt)}
                            title="Hapus"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setModal({ type: "idle" })}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
