"""Optimize storefront product images: resize to <=1400px + convert to WebP (q82), then repoint
master_skus.image_url / image_gallery to the .webp versions. Originals are kept (gitignored).
Idempotent. Typically cuts ~85-90% of bytes with no visible quality loss.
"""
import os, pathlib
from PIL import Image, ImageOps
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
DIR = pathlib.Path(__file__).resolve().parent.parent / "uploads" / "shopify_products"
MAX = 1400

def optimize():
    before = after = n = skipped = 0
    for f in sorted(DIR.glob("*")):
        if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        out = f.with_suffix(".webp")
        if out.exists():
            skipped += 1
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(f))
            im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
            if max(im.size) > MAX:
                im.thumbnail((MAX, MAX), Image.LANCZOS)
            im.save(out, "WEBP", quality=82, method=6)
            before += f.stat().st_size
            after += out.stat().st_size
            n += 1
        except Exception as e:
            print(f"  ! {f.name}: {e}")
    print(f"converted {n} images (skipped {skipped} already-webp): "
          f"{before/1e6:.0f}MB -> {after/1e6:.0f}MB "
          f"({100*(1-after/before):.0f}% smaller)" if before else "nothing to do")
    return n

def repoint_db():
    """Rewrite /uploads/shopify_products/X.(jpg|png) -> X.webp on every master_sku."""
    updated = 0
    def webpify(u):
        if isinstance(u, str) and "/uploads/shopify_products/" in u and u.rsplit(".", 1)[-1].lower() in ("jpg", "jpeg", "png"):
            cand = DIR / (pathlib.Path(u).stem + ".webp")
            if cand.exists():
                return u.rsplit(".", 1)[0] + ".webp"
        return u
    for m in db.master_skus.find({"image_url": {"$regex": "/uploads/shopify_products/"}},
                                 {"id": 1, "image_url": 1, "image_gallery": 1}):
        newurl = webpify(m.get("image_url"))
        newgal = [webpify(x) for x in (m.get("image_gallery") or [])]
        sets = {}
        if newurl != m.get("image_url"):
            sets["image_url"] = newurl
        if newgal != (m.get("image_gallery") or []):
            sets["image_gallery"] = newgal
        if sets:
            db.master_skus.update_one({"id": m["id"]}, {"$set": sets})
            updated += 1
    print(f"repointed {updated} master_skus to .webp")

if __name__ == "__main__":
    optimize()
    repoint_db()
