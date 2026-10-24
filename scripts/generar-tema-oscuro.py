#!/usr/bin/env python3
"""
Genera css/tema-oscuro-auto.css: la versión oscura de los colores fijos del sistema.

El CSS de Zentra MED usa variables para casi todo, pero aún tiene cientos de colores
escritos a mano (en style.css, en tema-botengine.css y en estilos en línea de index.html
y de los js). Este script los recorre y escribe, bajo :root[data-theme="dark"], la misma
regla con el color pasado a oscuro conservando su tono:

  - fondos claros  -> superficies oscuras (los tintes de color, translúcidos)
  - textos oscuros -> textos claros (los de color, aclarados)
  - bordes claros  -> bordes oscuros

Lo que no es claro/oscuro (botones de color, barras oscuras, sombras) se deja igual.
Los ajustes hechos a mano viven en css/tema-oscuro.css, que se carga después.

Uso (desde la raíz del proyecto):  python3 scripts/generar-tema-oscuro.py
Volver a ejecutarlo cuando cambien los colores de style.css o de los módulos.
"""

import colorsys
import glob
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES_CSS = ['css/style.css', 'css/tema-botengine.css']
FUENTES_EN_LINEA = ['index.html'] + sorted(glob.glob(os.path.join(RAIZ, 'js', '*.js')))
SALIDA = 'css/tema-oscuro-auto.css'
PREFIJO = ':root[data-theme="dark"]'

NOMBRADOS = {'white': (255, 255, 255), 'black': (0, 0, 0), 'whitesmoke': (245, 245, 245),
             'gainsboro': (220, 220, 220), 'lightgray': (211, 211, 211), 'lightgrey': (211, 211, 211),
             'silver': (192, 192, 192), 'gray': (128, 128, 128), 'grey': (128, 128, 128)}

COLOR = re.compile(
    r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b'
    r'|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)'
    r'|\b(?:' + '|'.join(NOMBRADOS) + r')\b', re.I)

PROPIEDADES = {
    'background': 'fondo', 'background-color': 'fondo', 'background-image': 'fondo',
    'color': 'texto', '-webkit-text-fill-color': 'texto', 'caret-color': 'texto', 'fill': 'texto',
    'border': 'borde', 'border-color': 'borde', 'border-top': 'borde', 'border-right': 'borde',
    'border-bottom': 'borde', 'border-left': 'borde', 'border-top-color': 'borde',
    'border-right-color': 'borde', 'border-bottom-color': 'borde', 'border-left-color': 'borde',
    'outline': 'borde', 'outline-color': 'borde', 'column-rule': 'borde',
}


def leer_color(texto):
    t = texto.lower()
    if t in NOMBRADOS:
        r, g, b = NOMBRADOS[t]
        return r, g, b, 1.0
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    partes = re.findall(r'[\d.]+%?', t)
    def canal(v):
        return float(v[:-1]) * 2.55 if v.endswith('%') else float(v)
    r, g, b = (canal(v) for v in partes[:3])
    a = 1.0
    if len(partes) > 3:
        a = float(partes[3][:-1]) / 100 if partes[3].endswith('%') else float(partes[3])
    return r, g, b, a


def escribir(h, l, s, a):
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), max(0, min(1, s)))
    r, g, b = (round(v * 255) for v in (r, g, b))
    return f'#{r:02x}{g:02x}{b:02x}' if a >= 0.999 else f'rgba({r}, {g}, {b}, {round(a, 3)})'


def oscurecer(texto, uso):
    """Color equivalente en el tema oscuro, o None si se deja igual."""
    r, g, b, a = leer_color(texto)
    if a == 0:
        return None
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    neutro = s < 0.25 or l > 0.97
    # Blancos o negros translúcidos son brillos y sombras sobre otro fondo: sirven igual en oscuro
    if a < 0.5 and uso != 'texto':
        return None
    if uso == 'fondo':
        if l >= 0.82:
            if neutro:  # blanco -> superficie; grises claros -> un poco más arriba (paneles dentro de tarjetas)
                return escribir(0.6, 0.115 + (1 - l) * 0.9, 0.2, a)
            return escribir(h, 0.5, min(s, 0.75), 0.16 * a)
        if l >= 0.6 and s < 0.15:
            return escribir(0.6, 0.28 + (0.82 - l) * 0.45, 0.12, a)
        return None
    if uso == 'texto':
        if l > 0.5:
            return None
        if s < 0.2:
            return escribir(h, 0.93 - l * 0.7, s, a)
        return escribir(h, max(0.68, 1 - l), min(s, 0.85), a)
    if uso == 'borde':
        if l < 0.75:
            return None
        if neutro:
            return escribir(0.6, 0.24 + (1 - l) * 0.3, 0.15, a)
        return escribir(h, 0.5, min(s, 0.7), 0.35 * a)
    return None


def convertir_valor(valor, uso):
    cambiado = False
    def reemplazar(m):
        nonlocal cambiado
        nuevo = oscurecer(m.group(0), uso)
        if nuevo is None:
            return m.group(0)
        cambiado = True
        return nuevo
    resultado = COLOR.sub(reemplazar, valor)
    return resultado if cambiado else None


def declaraciones_oscuras(cuerpo, forzar_importante=False):
    salida = []
    for decl in partir(cuerpo, ';'):
        if ':' not in decl:
            continue
        prop, valor = decl.split(':', 1)
        prop = prop.strip().lower()
        valor = valor.strip()
        uso = PROPIEDADES.get(prop)
        if not uso or 'var(' in valor or '${' in valor:
            continue
        importante = '!important' in valor or forzar_importante
        valor = valor.replace('!important', '').strip()
        nuevo = convertir_valor(valor, uso)
        if nuevo:
            salida.append(f'{prop}: {nuevo}{" !important" if importante else ""};')
    return salida


def partir(texto, separador):
    """Parte por el separador fuera de paréntesis y comillas."""
    partes, actual, nivel, comilla = [], '', 0, None
    for c in texto:
        if comilla:
            actual += c
            if c == comilla:
                comilla = None
            continue
        if c in '"\'':
            comilla = c
        elif c == '(':
            nivel += 1
        elif c == ')':
            nivel -= 1
        elif c == separador and nivel == 0:
            partes.append(actual)
            actual = ''
            continue
        actual += c
    if actual.strip():
        partes.append(actual)
    return partes


def prefijar(selectores):
    resultado = []
    for sel in partir(selectores, ','):
        sel = sel.strip()
        if not sel:
            continue
        if sel.startswith(':root'):
            resultado.append(PREFIJO + sel[len(':root'):])
        elif re.match(r'html\b', sel):
            resultado.append('html[data-theme="dark"]' + sel[4:])
        else:
            resultado.append(f'{PREFIJO} {sel}')
    return ',\n'.join(resultado)


def reglas(css):
    """Recorre el CSS y devuelve líneas oscuras, respetando @media y saltando @keyframes, @font-face y print."""
    salida = []
    i = 0
    while i < len(css):
        inicio = css.find('{', i)
        if inicio == -1:
            break
        prelude = css[i:inicio].strip()
        # cuerpo hasta la llave que cierra
        nivel, j = 1, inicio + 1
        while j < len(css) and nivel:
            if css[j] == '{':
                nivel += 1
            elif css[j] == '}':
                nivel -= 1
            j += 1
        cuerpo = css[inicio + 1:j - 1]
        i = j
        if prelude.startswith('@'):
            if re.match(r'@(media|supports)\b', prelude) and 'print' not in prelude:
                internas = reglas(cuerpo)
                if internas:
                    salida.append(f'{prelude} {{\n' + '\n'.join('    ' + l for l in '\n'.join(internas).split('\n')) + '\n}')
            continue
        decls = declaraciones_oscuras(cuerpo)
        if decls:
            salida.append(prefijar(prelude) + ' {\n' + '\n'.join('    ' + d for d in decls) + '\n}')
    return salida


def sin_comentarios(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def estilos_en_linea():
    """Reglas para los style="..." escritos en el HTML y en las plantillas de los js."""
    vistos = {}
    patron = re.compile(r'style="([^"]*)"')
    for ruta in FUENTES_EN_LINEA:
        with open(os.path.join(RAIZ, ruta) if not os.path.isabs(ruta) else ruta, encoding='utf-8') as f:
            texto = f.read()
        for estilo in patron.findall(texto):
            for decl in partir(estilo, ';'):
                if ':' not in decl or '${' in decl:
                    continue
                prop, valor = (p.strip() for p in decl.split(':', 1))
                uso = PROPIEDADES.get(prop.lower())
                if not uso or 'var(' in valor:
                    continue
                nuevo = convertir_valor(valor.replace('!important', '').strip(), uso)
                if nuevo:
                    vistos[decl.strip()] = (prop.lower(), nuevo)
    salida = []
    for original, (prop, nuevo) in sorted(vistos.items()):
        texto = original.replace('"', '\\"')
        if prop == 'color':
            # "color:" no debe coincidir con "background-color:"
            selectores = [f'[style^="{texto}"]', f'[style*="; {texto}"]', f'[style*=";{texto}"]']
        else:
            selectores = [f'[style*="{texto}"]']
        salida.append(',\n'.join(f'{PREFIJO} {s}' for s in selectores) + f' {{\n    {prop}: {nuevo} !important;\n}}')
    return salida


def main():
    bloques = []
    for ruta in FUENTES_CSS:
        with open(os.path.join(RAIZ, ruta), encoding='utf-8') as f:
            css = sin_comentarios(f.read())
        bloques.append(f'/* ---------- {ruta} ---------- */')
        bloques.extend(reglas(css))
    bloques.append('/* ---------- estilos en línea (index.html y js) ---------- */')
    bloques.extend(estilos_en_linea())
    encabezado = ('/* ============================================\n'
                  '   TEMA OSCURO · GENERADO AUTOMÁTICAMENTE\n'
                  '   No editar a mano: python3 scripts/generar-tema-oscuro.py\n'
                  '   Los ajustes manuales van en css/tema-oscuro.css.\n'
                  '   ============================================ */\n\n')
    with open(os.path.join(RAIZ, SALIDA), 'w', encoding='utf-8') as f:
        f.write(encabezado + '\n\n'.join(bloques) + '\n')
    print(f'{SALIDA}: {sum(1 for b in bloques if not b.startswith("/*"))} reglas')


if __name__ == '__main__':
    main()
