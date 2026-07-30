/** Resize an image file to a JPEG data URL for profile preferences. */
export function resizeImageToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Built-in staff portraits when an account has not uploaded a custom photo. */
const ROLE_DEFAULT_AVATAR: Record<string, string> = {
  admin: "/avatars/admin.jpg",
  doctor: "/avatars/doctor.jpg",
  nurse: "/avatars/nurse.jpg",
};

const USERNAME_DEFAULT_AVATAR: Record<string, string> = {
  admin: "/avatars/admin.jpg",
  doctor: "/avatars/doctor.jpg",
  nurse: "/avatars/nurse.jpg",
};

/** Marker stored in avatar_data after the user removes their photo (shows initials). */
export const AVATAR_CLEARED =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function isAvatarCleared(avatarData?: string | null): boolean {
  return (avatarData || "").trim() === AVATAR_CLEARED;
}

export function defaultAvatarForAccount(username?: string | null, role?: string | null): string {
  const u = (username || "").trim().toLowerCase();
  if (u && USERNAME_DEFAULT_AVATAR[u]) return USERNAME_DEFAULT_AVATAR[u];
  const r = (role || "").trim().toLowerCase();
  if (r && ROLE_DEFAULT_AVATAR[r]) return ROLE_DEFAULT_AVATAR[r];
  return "";
}

export function resolveStaffAvatar(opts: {
  avatarData?: string | null;
  username?: string | null;
  role?: string | null;
}): string {
  const custom = (opts.avatarData || "").trim();
  if (isAvatarCleared(custom)) return "";
  if (custom.startsWith("data:image/") || custom.startsWith("http") || custom.startsWith("/")) {
    return custom;
  }
  return defaultAvatarForAccount(opts.username, opts.role);
}
