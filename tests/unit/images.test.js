import { describe, it, expect } from 'vitest';
import { checkImageFile, slotKind, uploadableFile } from '../../src/editor/images.js';

const MB = 1024 * 1024;
// checkImageFile only reads name, type and size, so plain objects stand in for
// big files (no 200 MB buffers in a unit test).
const file = (name, type, size = 2 * MB) => ({ name, type, size });

const SIZE_PHOTO = 'Image is larger than 10 MB. Please use a smaller file.';
const TYPE_PHOTO = 'Please use a JPG, PNG or WebP image.';
const SIZE_VIDEO = 'Video is larger than 200 MB. Please use a smaller file.';
const TYPE_VIDEO = 'Please use an MP4 video.';

describe('checkImageFile (photo slots)', () => {
  it('accepts JPG, PNG and WebP up to 10 MB', () => {
    expect(checkImageFile(file('a.jpg', 'image/jpeg'))).toBeNull();
    expect(checkImageFile(file('a.png', 'image/png'))).toBeNull();
    expect(checkImageFile(file('a.webp', 'image/webp'))).toBeNull();
    expect(checkImageFile(file('a.jpg', 'image/jpeg', 10 * MB))).toBeNull();
    expect(checkImageFile(file('a.jpg', 'image/jpeg', 10 * MB), 'photo')).toBeNull();
  });

  it('rejects images larger than 10 MB', () => {
    expect(checkImageFile(file('phone.jpg', 'image/jpeg', 10 * MB + 1))).toBe(SIZE_PHOTO);
    expect(checkImageFile(file('phone.jpg', 'image/jpeg', 20 * MB))).toBe(SIZE_PHOTO);
  });

  it('rejects HEIC, GIF and SVG', () => {
    expect(checkImageFile(file('IMG_0001.HEIC', 'image/heic'))).toBe(TYPE_PHOTO);
    expect(checkImageFile(file('a.gif', 'image/gif'))).toBe(TYPE_PHOTO);
    expect(checkImageFile(file('a.svg', 'image/svg+xml'))).toBe(TYPE_PHOTO);
    // the type message wins over the size message: a smaller HEIC still fails
    expect(checkImageFile(file('IMG_0001.HEIC', 'image/heic', 20 * MB))).toBe(TYPE_PHOTO);
  });

  it('falls back to the file extension when the browser gives no type', () => {
    expect(checkImageFile(file('IMG_0001.HEIC', ''))).toBe(TYPE_PHOTO);
    expect(checkImageFile(file('photo.JPEG', ''))).toBeNull();
    expect(checkImageFile(file('noext', ''))).toBe(TYPE_PHOTO);
  });

  it('rejects a video dropped into a photo slot', () => {
    expect(checkImageFile(file('demo.mp4', 'video/mp4'))).toBe(TYPE_PHOTO);
  });
});

describe('checkImageFile (video slots, Ruling R4)', () => {
  it('accepts MP4 up to 200 MB', () => {
    expect(checkImageFile(file('demo.mp4', 'video/mp4', 150 * MB), 'video')).toBeNull();
    expect(checkImageFile(file('demo.mp4', 'video/mp4', 200 * MB), 'video')).toBeNull();
  });

  it('rejects videos larger than 200 MB', () => {
    expect(checkImageFile(file('demo.mp4', 'video/mp4', 200 * MB + 1), 'video')).toBe(SIZE_VIDEO);
  });

  it('rejects other formats, photos included', () => {
    expect(checkImageFile(file('demo.mov', 'video/quicktime'), 'video')).toBe(TYPE_VIDEO);
    expect(checkImageFile(file('a.jpg', 'image/jpeg'), 'video')).toBe(TYPE_VIDEO);
  });
});

describe('slotKind', () => {
  it('is "video" for the video slide\'s video slot and "photo" everywhere else', () => {
    expect(slotKind('video')).toBe('video');
    expect(slotKind('poster')).toBe('photo');
    expect(slotKind('personality')).toBe('photo');
  });
});

describe('uploadableFile', () => {
  it('keeps a file that has a type', () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    expect(uploadableFile(f)).toBe(f);
  });

  it('gives a type-less file the type of its extension, so the upload is accepted', () => {
    const f = new File(['x'], 'photo.JPG', { type: '' });
    const out = uploadableFile(f);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('photo.JPG');
    expect(out.size).toBe(1);
  });
});
