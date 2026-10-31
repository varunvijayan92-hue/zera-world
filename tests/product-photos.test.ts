import assert from "node:assert/strict";
import test from "node:test";
import { validatePhoto, uploadProductPhotos, productPhotoStore, MAX_PHOTO_BYTES, changePhotoOrder } from "../lib/product-photos";
import { cloudinaryMedia, cloudinarySettings } from "../lib/cloudinary";
import { isCloudinaryPhoto } from "../lib/image-source";
import { categorySchema, categorySlug, categoryLink, nextCategoryPosition } from "../lib/category";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xQAAAABJRU5ErkJggg==", "base64");
const file = () => new File([png], "test.png", { type: "image/png" });

test("photo validation rejects oversized, empty, unsupported and disguised files", async () => {
  await assert.doesNotReject(() => validatePhoto(file()));
  await assert.rejects(() => validatePhoto(new File([], "empty.png", { type: "image/png" })));
  await assert.rejects(() => validatePhoto(new File([Buffer.alloc(MAX_PHOTO_BYTES + 1)], "large.png", { type: "image/png" })));
  await assert.rejects(() => validatePhoto(new File(["<svg></svg>"], "x.svg", { type: "image/svg+xml" })));
  await assert.rejects(() => validatePhoto(new File(["<svg></svg>"], "fake.png", { type: "image/png" })));
});

test("upload links photos to the chosen product while preserving its existing main photo", async (t) => {
  t.mock.method(productPhotoStore, "find", async () => ({ id: "p1", imageUrls: ["existing"] }));
  const upload = t.mock.method(cloudinaryMedia, "upload", async () => ({ publicId: "new", url: "https://res.cloudinary.com/test/image/upload/v1/new.png" }));
  const change = t.mock.method(productPhotoStore, "change", async (id: string, transform: (urls: string[]) => string[]) => ({ id, imageUrls: transform(["existing"]) }));
  const result = await uploadProductPhotos("p1", [file()]);
  assert.equal(upload.mock.calls[0].arguments[1], "p1");
  assert.equal(change.mock.callCount(), 1);
  assert.deepEqual(result.imageUrls, ["existing", "https://res.cloudinary.com/test/image/upload/v1/new.png"]);
});

test("invalid batches and full galleries do not start Cloudinary uploads", async (t) => {
  const find = t.mock.method(productPhotoStore, "find", async () => ({ id: "p1", imageUrls: [] as string[] }));
  const upload = t.mock.method(cloudinaryMedia, "upload", async () => ({ publicId: "unused", url: "unused" }));
  await assert.rejects(() => uploadProductPhotos("p1", []));
  await assert.rejects(() => uploadProductPhotos("p1", [file(), new File(["bad"], "fake.png", { type: "image/png" })]));
  find.mock.mockImplementation(async () => ({ id: "p1", imageUrls: Array(6).fill("old") }));
  await assert.rejects(() => uploadProductPhotos("p1", [file()]));
  assert.equal(upload.mock.callCount(), 0);
});

test("partial batch failure cleans up only newly uploaded assets", async (t) => {
  t.mock.method(productPhotoStore, "find", async () => ({ id: "p1", imageUrls: ["existing"] }));
  let count = 0;
  t.mock.method(cloudinaryMedia, "upload", async () => { if (count++) throw Error("Upload failed"); return { publicId: "new-only", url: "new-url" }; });
  const remove = t.mock.method(cloudinaryMedia, "removeOwnUpload", async () => {});
  const change = t.mock.method(productPhotoStore, "change", async (id: string) => ({ id, imageUrls: [] }));
  await assert.rejects(() => uploadProductPhotos("p1", [file(), file()]));
  assert.equal(change.mock.callCount(), 0);
  assert.equal(remove.mock.calls[0].arguments[0], "new-only");
});

test("database attachment failure also cleans up new Cloudinary uploads", async (t) => {
  t.mock.method(productPhotoStore, "find", async () => ({ id: "p1", imageUrls: [] }));
  t.mock.method(cloudinaryMedia, "upload", async () => ({ publicId: "new-only", url: "new-url" }));
  t.mock.method(productPhotoStore, "change", async () => { throw Error("Database unavailable"); });
  const remove = t.mock.method(cloudinaryMedia, "removeOwnUpload", async () => {});
  await assert.rejects(() => uploadProductPhotos("p1", [file()]));
  assert.equal(remove.mock.calls[0].arguments[0], "new-only");
});

test("cover and unlink operations are restricted to the selected product's photos", () => {
  assert.deepEqual(changePhotoOrder(["a", "b"], "b", "cover"), ["b", "a"]);
  assert.deepEqual(changePhotoOrder(["a", "b"], "a", "remove"), ["b"]);
  assert.throws(() => changePhotoOrder(["a"], "another-product-photo", "remove"));
});

test("optimized delivery recognizes only versioned URLs for the configured cloud", () => {
  assert.equal(isCloudinaryPhoto("https://res.cloudinary.com/mycloud/image/upload/v1/folder/photo.png", "mycloud"), true);
  assert.equal(isCloudinaryPhoto("https://res.cloudinary.com/other/image/upload/v1/photo.png", "mycloud"), false);
  assert.equal(isCloudinaryPhoto("https://res.cloudinary.com.evil/image/upload/v1/photo.png", "mycloud"), false);
  assert.equal(isCloudinaryPhoto("https://res.cloudinary.com/mycloud/image/upload/photo.png", "mycloud"), false);
});

test("menu slugs are stable and reserved or unsafe category inputs are rejected", () => {
  assert.equal(categorySlug("Gift Edit"), "gift-edit");
  assert.equal(categorySlug("  Home & Living! "), "home-living");
  assert.equal(categoryLink("gift-edit"), "/products?category=gift-edit");
  assert.equal(categorySchema.safeParse({ name: "Home", slug: "home" }).success, true);
  assert.equal(categorySchema.safeParse({ name: "All", slug: "all" }).success, false);
  assert.equal(categorySchema.safeParse({ name: "Bad", slug: "../admin" }).success, false);
});

test("new menu entries append after the last position even when deletion left gaps", () => {
  assert.equal(nextCategoryPosition([]), 0);
  assert.equal(nextCategoryPosition([{ sortOrder: 0 }, { sortOrder: 3 }]), 4);
});

test("Cloudinary configuration rejects malformed/masked URLs without exposing values", () => {
  const previous = process.env.CLOUDINARY_URL;
  try {
    process.env.CLOUDINARY_URL = "invalid";
    assert.throws(() => cloudinarySettings(), /not configured/);
    process.env.CLOUDINARY_URL = "cloudinary://unit-key:********@unit-cloud";
    assert.throws(() => cloudinarySettings(), /not configured/);
    process.env.CLOUDINARY_URL = "cloudinary://unit-key:unit-secret@unit-cloud";
    assert.equal(cloudinarySettings().cloud_name, "unit-cloud");
  } finally { if (previous === undefined) delete process.env.CLOUDINARY_URL; else process.env.CLOUDINARY_URL = previous; }
});
