# Guía para las imágenes con IA (REL-11)

Esta guía sirve para crear un set de imágenes ilustradas con el mismo estilo, para reemplazar las fotos de stock del sitio. Está escrita en español sencillo; los textos para la IA (prompts) están en inglés porque las herramientas los entienden mejor así.

## 1. Estilo (para que todas se vean de la misma familia)

- Ilustración suave, plana o con textura de pintura, luz natural cálida.
- Colores del sitio: verde salvia, arena y crema (evita colores muy saturados).
- Sin texto dentro de la imagen y sin logotipos.
- Personas diversas y representadas con respeto; sin rostros muy detallados (se ven mejor en estilo ilustrado).
- Fondo sencillo, mucho espacio libre para que respire el diseño.

## 2. Herramienta y licencia

Usa una herramienta cuya licencia permita **uso comercial** (por ejemplo Adobe Firefly, Ideogram o Midjourney con plan de pago). Anota aquí cuál usaste, porque hay que guardar ese dato:

| Herramienta   | Plan                                 | Fecha   | Notas                                                                      |
| ------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------- |
| Google Gemini | (completar: plan gratuito o de pago) | 2026-10 | Imágenes generadas por el dueño; revisar que el plan permita uso comercial |

## 3. Plantilla del prompt

> Soft illustrated scene of a **[DESCRIPCIÓN]** in a calm home setting, warm natural light, sage green, sand and cream palette, gentle painterly texture, minimal background, peaceful mood, no text, no logos

Reemplaza `[DESCRIPCIÓN]` con una de la tabla de abajo. Si el resultado no combina con las demás imágenes, repite con el mismo estilo (en Midjourney puedes usar `--sref` con tu mejor imagen; en Firefly, "Style reference").

## 4. Imágenes que hacen falta

| Archivo (guárdalo en `src/assets/images/ai/`) | Dónde se usa                        | Proporción y tamaño sugerido | Descripción para el prompt                                                                            |
| --------------------------------------------- | ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `hero.webp`                                   | Portada (computadora)               | 16:9, 1920×1080              | massage table with folded towels, candles and green plants by a sunny window                          |
| `hero-mobile.webp`                            | Portada (teléfono)                  | 4:5, 960×1200                | the same scene as the hero, framed vertically                                                         |
| `about.webp`                                  | "¿Por qué elegirnos?"               | 4:5, 860×1075                | a therapist preparing a calm treatment space at home with towels, stones and plants                   |
| `relaxing.webp`                               | Masaje relajante                    | 4:3, 960×720                 | person lying face down receiving a slow, gentle relaxing back massage                                 |
| `decontracting.webp`                          | Masaje descontracturante            | 4:3, 960×720                 | therapist applying firm pressure to the shoulder and neck of a seated person                          |
| `lymphatic.webp`                              | Masaje linfático                    | 4:3, 960×720                 | therapist doing light, rhythmic lymphatic drainage strokes on a person's leg                          |
| `shiatsu.webp`                                | Shiatsu                             | 4:3, 960×720                 | therapist using finger pressure along the back in a shiatsu massage                                   |
| `sport.webp`                                  | Masaje deportivo                    | 4:3, 960×720                 | therapist stretching and massaging the leg of an active person after exercise                         |
| `deep-facial.webp`                            | Facial de limpieza profunda         | 4:3, 960×720                 | person receiving a deep-cleansing facial with a soft clay mask                                        |
| `moisturizing-facial.webp`                    | Facial hidratante                   | 4:3, 960×720                 | person receiving a gentle moisturizing facial massage with glowing skin                               |
| `prenatal.webp`                               | Masaje prenatal                     | 4:3, 960×720                 | pregnant person lying comfortably on their side with pillows while receiving a safe, gentle massage   |
| `og-image.png`                                | Al compartir el sitio (WhatsApp...) | 1200×630                     | calm scene with space on one side (el nombre se agrega después en Canva u otra herramienta de diseño) |

Consejos:

- Cada imagen debe quedar por debajo de **200 KB** ya optimizada. Una herramienta como https://squoosh.app/ ayuda (formato WebP, calidad 80).
- Guarda también los archivos originales en alta resolución en un lugar seguro (no hace falta subirlos al sitio).

## 5. Qué hago yo cuando las tengas

1. Me avisas que las imágenes están en `src/assets/images/ai/` (o me las pasas por el medio que prefieras).
2. Las conecto en el sitio: la portada, "¿Por qué elegirnos?", las 8 tarjetas de servicios (`src/data/services.js`, campo `image`) y la imagen para compartir (`public/og-image.png`).
3. Los textos descriptivos (alt) de cada servicio ya existen en español e inglés; los reviso para que coincidan con la nueva ilustración.
4. Agrego un movimiento muy suave (flotar o acercarse lentamente) a la portada, que se apaga si la persona tiene activada la opción de "reducir movimiento".
5. Borro las imágenes viejas que ya no se usan y reviso que el sitio siga rápido (Lighthouse).

## 6. Lista de revisión

- [ ] Todas comparten el mismo estilo y paleta.
- [ ] Ninguna lleva texto ni logotipos.
- [ ] Cada una pesa menos de 200 KB.
- [ ] Anoté la herramienta y el plan de licencia en la tabla de arriba.
