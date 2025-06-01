import JSZip from 'jszip';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const generateFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

export const base64ToBlob = (base64: string, type: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type });
};

export const createZipFile = async (
  mainJson: string,
  files: { [key: string]: string }
): Promise<Blob> => {
  const zip = new JSZip();

  // Добавляем все файлы в корень архива
  Object.entries(files).forEach(([filename, content]) => {
    // Если контент начинается с data: (base64), то это файл или изображение
    if (content.startsWith('data:')) {
      zip.file(filename, content.split(',')[1], { base64: true });
    } else {
      // Иначе это текстовый файл
      zip.file(filename, content);
    }
  });

  return zip.generateAsync({ type: 'blob' });
};

// Максимальный размер файла (2 МБ)
export const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isFileSizeValid = (file: File): boolean => {
  return file.size <= MAX_FILE_SIZE;
}; 