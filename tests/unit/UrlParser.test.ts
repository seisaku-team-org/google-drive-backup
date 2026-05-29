import { describe, it, expect } from 'vitest';
import { parseFolderUrl } from '../../src/domain/UrlParser';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-12345';

describe('parseFolderUrl', () => {
  it('一般的な共有 URL からフォルダ ID を抽出する', () => {
    expect(parseFolderUrl(`https://drive.google.com/drive/folders/${ID}`)).toEqual({
      ok: true,
      folderId: ID,
    });
  });

  it('?usp=sharing 等のクエリが付いていても抽出できる', () => {
    expect(parseFolderUrl(`https://drive.google.com/drive/folders/${ID}?usp=sharing`)).toEqual({
      ok: true,
      folderId: ID,
    });
  });

  it('/drive/u/0/folders/{id} 形式も抽出できる', () => {
    expect(parseFolderUrl(`https://drive.google.com/drive/u/0/folders/${ID}`)).toEqual({
      ok: true,
      folderId: ID,
    });
  });

  it('旧 UI の /open?id={id} 形式も抽出できる', () => {
    expect(parseFolderUrl(`https://drive.google.com/open?id=${ID}`)).toEqual({
      ok: true,
      folderId: ID,
    });
  });

  it('ID 単独の文字列を受け付ける', () => {
    expect(parseFolderUrl(ID)).toEqual({ ok: true, folderId: ID });
  });

  it('前後の空白はトリムする', () => {
    expect(parseFolderUrl(`   ${ID}   `)).toEqual({ ok: true, folderId: ID });
  });

  it('/file/d/{id}/view（ファイル URL）は NOT_A_FOLDER を返す', () => {
    expect(parseFolderUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toEqual({
      ok: false,
      reason: 'NOT_A_FOLDER',
    });
  });

  it('空文字は INVALID_URL を返す', () => {
    expect(parseFolderUrl('')).toEqual({ ok: false, reason: 'INVALID_URL' });
    expect(parseFolderUrl('   ')).toEqual({ ok: false, reason: 'INVALID_URL' });
  });

  it('Drive と関係ない URL は INVALID_URL を返す', () => {
    expect(parseFolderUrl('https://example.com/foo')).toEqual({
      ok: false,
      reason: 'INVALID_URL',
    });
  });

  it('Drive URL でも ID が含まれていなければ INVALID_URL を返す', () => {
    expect(parseFolderUrl('https://drive.google.com/drive/my-drive')).toEqual({
      ok: false,
      reason: 'INVALID_URL',
    });
  });

  it('短すぎる ID は受け付けない（19 文字以下）', () => {
    expect(parseFolderUrl('1abc')).toEqual({ ok: false, reason: 'INVALID_URL' });
  });
});
