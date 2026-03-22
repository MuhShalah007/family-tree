import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { personSchema, type PersonFormData, type Gender, type Person } from "@/types/family";
import { cn } from "@/lib/utils";

interface AddPersonFormProps {
  onSubmit: (data: PersonFormData, secondParentId?: string) => void;
  onCancel: () => void;
  title: string;
  defaultGender?: Gender;
  initialData?: Person;
  disableGender?: boolean;
  spouses?: Person[];
}

export function AddPersonForm({ onSubmit, onCancel, title, defaultGender, initialData, disableGender, spouses }: AddPersonFormProps) {
  const [fullName, setFullName] = useState(initialData?.full_name || "");
  const [gender, setGender] = useState<Gender | "">(initialData?.gender || defaultGender || "");
  const [phone, setPhone] = useState(initialData?.phone_number || "");
  const [birthDate, setBirthDate] = useState(initialData?.birth_date || "");
  const [secondParentId, setSecondParentId] = useState<string>(spouses?.length === 1 ? spouses[0].id : "");
  const [linkSingleSpouse, setLinkSingleSpouse] = useState<boolean>(spouses?.length === 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!spouses || spouses.length !== 1) {
      return;
    }

    setSecondParentId(spouses[0].id);
    setLinkSingleSpouse(true);
  }, [spouses]);

  const handleSubmit = () => {
    const result = personSchema.safeParse({
      full_name: fullName,
      gender: gender || undefined,
      phone_number: phone || undefined,
      birth_date: birthDate || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const selectedSecondParent =
      spouses?.length === 1 ? (linkSingleSpouse ? secondParentId : "") : secondParentId;
    onSubmit(result.data, selectedSecondParent || undefined);
  };

  return (
    <div className="animate-slide-up space-y-5 p-1">
      <h3 className="text-lg font-bold text-foreground">{title}</h3>

      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-sm font-medium">
          Nama Lengkap <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Contoh: Ahmad Subarjo"
          className="h-12 text-base"
          autoFocus
        />
        {errors.full_name && (
          <p className="text-sm text-destructive">{errors.full_name}</p>
        )}
      </div>

      {spouses && spouses.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="secondParent" className="text-sm font-medium">
            Pilih Orang Tua Lain (Pasangan) <span className="text-muted-foreground">(opsional)</span>
          </Label>
          <select
            id="secondParent"
            value={secondParentId}
            onChange={(e) => setSecondParentId(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">-- Tanpa Pasangan --</option>
            {spouses.map((spouse) => (
              <option key={spouse.id} value={spouse.id}>
                {spouse.full_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Anak akan dikaitkan dengan kedua orang tua.
          </p>
        </div>
      )}

      {spouses && spouses.length === 1 && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-foreground">
            Pasangan terdeteksi: <span className="font-semibold">{spouses[0].full_name}</span>
          </p>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={linkSingleSpouse}
              onChange={(event) => setLinkSingleSpouse(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>Hubungkan juga sebagai orang tua kandung (hilangkan centang jika bukan anak kandung pasangan).</span>
          </label>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Jenis Kelamin <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disableGender}
            onClick={() => setGender("L")}
            className={cn(
              "flex h-14 items-center justify-center rounded-xl border-2 text-base font-semibold transition-all active:scale-[0.97]",
              gender === "L"
                ? "border-family-male bg-family-male/10 text-family-male"
                : "border-border bg-card text-muted-foreground hover:border-family-male/50",
              disableGender && "opacity-50 cursor-not-allowed"
            )}
          >
            👨 Laki-laki
          </button>
          <button
            type="button"
            disabled={disableGender}
            onClick={() => setGender("P")}
            className={cn(
              "flex h-14 items-center justify-center rounded-xl border-2 text-base font-semibold transition-all active:scale-[0.97]",
              gender === "P"
                ? "border-family-female bg-family-female/10 text-family-female"
                : "border-border bg-card text-muted-foreground hover:border-family-female/50",
              disableGender && "opacity-50 cursor-not-allowed"
            )}
          >
            👩 Perempuan
          </button>
        </div>
        {errors.gender && (
          <p className="text-sm text-destructive">{errors.gender}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate" className="text-sm font-medium">
          Tanggal Lahir <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Input
          id="birthDate"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          type="date"
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium">
          Nomor HP <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          className="h-12 text-base"
          type="tel"
        />
        {errors.phone_number && (
          <p className="text-sm text-destructive">{errors.phone_number}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Batal
        </Button>
        <Button onClick={handleSubmit} className="flex-1">
          {initialData ? "Perbarui" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
