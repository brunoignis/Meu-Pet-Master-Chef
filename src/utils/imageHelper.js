/**
 * Redimensiona e comprime uma foto selecionada no celular (Base64)
 * para manter o banco interno rápido e leve no Android.
 */
export function comprimirImagem(file, maxLado = 500, qualidade = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxLado) {
          height = Math.round((height * maxLado) / width);
          width = maxLado;
        } else if (height > maxLado) {
          width = Math.round((width * maxLado) / height);
          height = maxLado;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}