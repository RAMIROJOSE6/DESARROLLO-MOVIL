import { Directory, File, Paths } from "expo-file-system";

const photosDirectory = new Directory(Paths.document, "geocam-photos");

/** Copy temporary camera/gallery media into app documents for offline access. */
export async function persistPhotoFile(sourceUri: string, id: string): Promise<string> {
  if (sourceUri.startsWith(photosDirectory.uri)) return sourceUri;

  photosDirectory.create({ intermediates: true, idempotent: true });
  const source = new File(sourceUri);
  const extension = source.extension || ".jpg";
  const destination = new File(photosDirectory, `${id}${extension}`);
  await source.copy(destination);
  return destination.uri;
}

export async function deleteStoredPhotoFile(uri: string): Promise<void> {
  if (!uri.startsWith(photosDirectory.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
