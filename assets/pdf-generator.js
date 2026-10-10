/**
 * Universo Gráfico – Motor de Generación y Compartición de PDF para WhatsApp
 * Integración nativa con jsPDF y jsPDF-AutoTable
 * Compatible 100% con modo PWA Offline y Web Share API de archivos
 */

(function (window) {
  'use strict';

  function formatMoney(amount) {
    return '$' + Math.round(Number(amount) || 0).toLocaleString('es-CO');
  }

  function formatMoneyCop(amount) {
    return '$' + Math.round(Number(amount) || 0).toLocaleString('es-CO') + ' COP';
  }

  // Conversión formal de números a letras en español según estándar legal colombiano
  function numeroALetras(num) {
    if (typeof window !== 'undefined' && typeof window.numeroALetras === 'function' && window.numeroALetras !== numeroALetras) {
      return window.numeroALetras(num);
    }
    num = Math.round(Number(num) || 0);
    const formattedNumber = num.toLocaleString('es-CO');
    if (num === 0) return 'Cero pesos m/cte. ($0.oo)';
    if (num < 0) return 'Menos ' + numeroALetras(-num);

    const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const DECENAS_10 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const VEINTES = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    function seccionMenorMil(n) {
      if (n === 0) return '';
      if (n === 100) return 'cien';
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;
      let res = '';
      if (c > 0) res += CENTENAS[c] + ' ';
      if (d === 1) {
        res += DECENAS_10[u];
      } else if (d === 2) {
        res += VEINTES[u];
      } else if (d > 2) {
        res += DECENAS[d];
        if (u > 0) res += ' y ' + UNIDADES[u];
      } else if (u > 0) {
        res += UNIDADES[u];
      }
      return res.trim();
    }

    function resolver(n) {
      const millones = Math.floor(n / 1000000);
      const restoMillones = n % 1000000;
      const miles = Math.floor(restoMillones / 1000);
      const unidades = restoMillones % 1000;

      const partes = [];
      if (millones > 0) {
        if (millones === 1) partes.push('un millón');
        else partes.push(seccionMenorMil(millones) + ' millones');
      }
      if (miles > 0) {
        if (miles === 1) partes.push('mil');
        else partes.push(seccionMenorMil(miles) + ' mil');
      }
      if (unidades > 0) {
        partes.push(seccionMenorMil(unidades));
      }
      return partes.join(' ');
    }

    const letras = resolver(num);
    const esDePesos = (num >= 1000000 && (num % 1000000 === 0));
    const sufijo = num === 1 ? 'peso m/cte.' : (esDePesos ? 'de pesos m/cte.' : 'pesos m/cte.');

    const resultado = `${letras} ${sufijo} ($${formattedNumber}.oo)`;
    return resultado.charAt(0).toUpperCase() + resultado.slice(1);
  }

  function formatDateSpanish(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} de ${months[monthIdx]} de ${year}`;
      }
    }
    return dateStr;
  }

  // Dibuja una barra superior con degradado idéntico al logotipo oficial (Magenta cálido a Violeta profundo)
  function drawLogoGradientBar(doc, pageWidth, height = 4.5) {
    const steps = 140;
    const sliceWidth = pageWidth / steps;
    // Degradado del logo: Magenta cálido (#E11D62) a Morado profundo (#6D28D9)
    const c1 = [225, 29, 98];   // Magenta
    const c2 = [109, 40, 217];  // Morado Universo
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(c1[0] + t * (c2[0] - c1[0]));
      const g = Math.round(c1[1] + t * (c2[1] - c1[1]));
      const b = Math.round(c1[2] + t * (c2[2] - c1[2]));
      doc.setFillColor(r, g, b);
      doc.rect(i * sliceWidth, 0, sliceWidth + 0.3, height, 'F');
    }
  }

  // ==========================================================================
  // 1. GENERACIÓN DE COTIZACIÓN EN PDF (FORMATO A4 / CARTA UNIVERSO GRÁFICO)
  // ==========================================================================
  function createPdfDocument(data) {
    const jspdfObj = (typeof window !== 'undefined' && (window.jspdf || window.jsPDF));
    if (!jspdfObj) {
      throw new Error('La librería jsPDF no está cargada.');
    }

    const jsPDF = jspdfObj.jsPDF || jspdfObj;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Colores del documento: Estilo corporativo formal con partes moradas cambiadas a negro
    const primaryColor = [15, 23, 42];   // Negro / grafito elegante (#0F172A)
    const darkColor = [15, 23, 42];      // #0F172A
    const grayText = [100, 116, 139];    // #64748B
    const lightBg = [248, 250, 252];     // #F8FAFC
    const borderColor = [226, 232, 240]; // #E2E8F0

    // Barra superior con degradado morado idéntico al logotipo
    drawLogoGradientBar(doc, pageWidth, 4.5);

    // 1. Logo de Universo Gráfico
    let yPos = 13;
    const logoW = 48;
    const logoH = 13; // Proporción 3.72:1

    if (data.includeLogo !== false && window.UNIVERSO_GRAFICO_LOGO) {
      try {
        doc.addImage(window.UNIVERSO_GRAFICO_LOGO, 'PNG', margin, yPos, logoW, logoH);
        yPos += logoH + 4;
      } catch (e) {
        console.warn('No se pudo insertar la imagen del logo en PDF:', e);
        yPos += 2;
      }
    }

    // 2. Información del Emisor / Universo Gráfico (Izquierda)
    const businessName = data.businessName || (window.state && window.state.settings && window.state.settings.businessName) || 'Universo Gráfico';
    const businessPhone = data.businessPhone || (window.state && window.state.settings && window.state.settings.phone) || '3239421252';
    const businessAddress = data.businessAddress || (window.state && window.state.settings && window.state.settings.address) || 'Bogotá, Colombia';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(businessName, margin, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('Diseño Gráfico & Desarrollo Web', margin, yPos + 4.5);
    doc.text('WhatsApp: ' + businessPhone, margin, yPos + 9);
    doc.text(businessAddress, margin, yPos + 13.5);

    // 3. Tarjeta de Cotización (Derecha)
    const metaBoxWidth = 66;
    const metaBoxX = pageWidth - margin - metaBoxWidth;
    const metaBoxY = 12;

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, 27, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('COTIZACIÓN', metaBoxX + (metaBoxWidth / 2), metaBoxY + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(data.number || 'COT-0001', metaBoxX + (metaBoxWidth / 2), metaBoxY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('Fecha: ' + formatDateSpanish(data.date), metaBoxX + 6, metaBoxY + 19);
    doc.text('Válida por: ' + (data.validityDays || 15) + ' días', metaBoxX + 6, metaBoxY + 24);

    yPos = Math.max(yPos + 18, metaBoxY + 33);

    // 4. Tarjeta del Cliente
    const hasProjectDesc = !!data.clientDesc;
    const clientBoxHeight = hasProjectDesc ? 23 : 17;

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), clientBoxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PROPUESTA PRESENTADA A:', margin + 6, yPos + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(data.clientName || 'Cliente General', margin + 6, yPos + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('Teléfono / WhatsApp: ' + (data.clientPhone || 'No registrado'), (pageWidth / 2) + 6, yPos + 11.5);

    if (hasProjectDesc) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('Proyecto: ', margin + 6, yPos + 17.5);
      doc.setFont('helvetica', 'normal');
      doc.text(data.clientDesc, margin + 24, yPos + 17.5);
    }

    yPos += clientBoxHeight + 8;

    // 5. Tabla de Ítems con AutoTable
    const tableColumns = [
      { header: 'DESCRIPCIÓN DEL SERVICIO', dataKey: 'desc' },
      { header: 'CANT.', dataKey: 'qty' },
      { header: 'V. UNITARIO', dataKey: 'unit' },
      { header: 'TOTAL', dataKey: 'total' }
    ];

    const tableRows = (data.items || []).map(item => ({
      desc: item.desc || item.name || 'Servicio',
      qty: String(item.qty || 1),
      unit: formatMoney(item.price || 0),
      total: formatMoney((item.qty || 1) * (item.price || 0))
    }));

    if (tableRows.length === 0) {
      tableRows.push({
        desc: 'Sin servicios especificados',
        qty: '1',
        unit: '$0',
        total: '$0'
      });
    }

    const tableConfig = {
      startY: yPos,
      margin: { left: margin, right: margin },
      columns: tableColumns,
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        textColor: darkColor,
        cellPadding: 3.8
      },
      columnStyles: {
        desc: { cellWidth: 'auto' },
        qty: { cellWidth: 16, halign: 'center' },
        unit: { cellWidth: 32, halign: 'right' },
        total: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableConfig);
    } else if (typeof window !== 'undefined' && window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, tableConfig);
    } else if (typeof window !== 'undefined' && typeof window.autoTable === 'function') {
      window.autoTable(doc, tableConfig);
    }

    const lastTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY)
      || (doc.autoTable && doc.autoTable.previous && doc.autoTable.previous.finalY)
      || (yPos + 35);
    yPos = lastTableY + 8;

    // 6. Resumen de Totales y Notas
    const totalsWidth = 76;
    const totalsX = pageWidth - margin - totalsWidth;
    const totalsStartY = yPos;

    let totalsRowsCount = 1; // Grand total
    const subtotal = Number(data.subtotal) || 0;
    const discountAmt = Number(data.discountAmount) || 0;
    const extraCharges = Number(data.extraCharges) || 0;
    const taxAmt = Number(data.taxAmount) || 0;
    const grandTotal = Number(data.grandTotal) || subtotal;

    if (discountAmt > 0) totalsRowsCount++;
    if (extraCharges > 0) totalsRowsCount++;
    if (taxAmt > 0) totalsRowsCount++;

    const totalsHeight = (totalsRowsCount * 5.8) + 16;

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(totalsX, totalsStartY, totalsWidth, totalsHeight, 3, 3, 'FD');

    let currentTotalY = totalsStartY + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    // Subtotal
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('Subtotal:', totalsX + 6, currentTotalY);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(formatMoney(subtotal), totalsX + totalsWidth - 6, currentTotalY, { align: 'right' });

    // Descuento
    if (discountAmt > 0) {
      currentTotalY += 5.8;
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Descuento (${data.discountPct || 0}%):`, totalsX + 6, currentTotalY);
      doc.setTextColor(220, 38, 38);
      doc.text('-' + formatMoney(discountAmt), totalsX + totalsWidth - 6, currentTotalY, { align: 'right' });
    }

    // Otros cargos
    if (extraCharges > 0) {
      currentTotalY += 5.8;
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Otros cargos:', totalsX + 6, currentTotalY);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('+' + formatMoney(extraCharges), totalsX + totalsWidth - 6, currentTotalY, { align: 'right' });
    }

    // IVA
    if (taxAmt > 0) {
      currentTotalY += 5.8;
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`IVA (${data.taxRate || 0}%):`, totalsX + 6, currentTotalY);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('+' + formatMoney(taxAmt), totalsX + totalsWidth - 6, currentTotalY, { align: 'right' });
    }

    // Total Destacado en Púrpura Universo
    currentTotalY += 7;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(totalsX + 3, currentTotalY - 4.5, totalsWidth - 6, 8, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', totalsX + 7, currentTotalY + 1.5);
    doc.text(formatMoney(grandTotal), totalsX + totalsWidth - 7, currentTotalY + 1.5, { align: 'right' });

    // Notas y Condiciones (Izquierda)
    const notesWidth = totalsX - margin - 8;
    if (data.includeNotes !== false && data.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('GARANTÍAS, NOTAS Y CONDICIONES:', margin, totalsStartY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);

      const splitNotes = doc.splitTextToSize(data.notes, notesWidth);
      doc.text(splitNotes, margin, totalsStartY + 10.5);
    }

    // 7. Pie de Página Formal
    const footerY = pageHeight - 14;
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text(`Gracias por confiar en ${businessName} · Diseño Gráfico & Desarrollo Web · WhatsApp: ${businessPhone}`, pageWidth / 2, footerY, { align: 'center' });

    return doc;
  }

  // ==========================================================================
  // 2. GENERACIÓN DE CUENTA DE COBRO EN PDF (TAMAÑO CARTA ESTÁNDAR COLOMBIANO)
  // ==========================================================================
  function createCobroPdfDocument(data) {
    const jspdfObj = (typeof window !== 'undefined' && (window.jspdf || window.jsPDF));
    if (!jspdfObj) {
      throw new Error('La librería jsPDF no está cargada.');
    }

    const jsPDF = jspdfObj.jsPDF || jspdfObj;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
    const margin = 16;
    const contentWidth = pageWidth - (margin * 2);

    let yPos = 14;
    const primaryColor = [15, 23, 42]; // Negro corporativo (#0F172A)
    const darkColor = [15, 23, 42];

    // Barra superior con degradado idéntico al logotipo
    drawLogoGradientBar(doc, pageWidth, 4.5);

    // Encabezado con Logo si está activado
    if (data.includeLogo !== false && window.UNIVERSO_GRAFICO_LOGO) {
      try {
        const logoW = 46;
        const logoH = 12.4;
        doc.addImage(window.UNIVERSO_GRAFICO_LOGO, 'PNG', margin, yPos, logoW, logoH);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const bName = (data.emisor && data.emisor.businessName) || 'Universo Gráfico';
        const bPhone = (data.emisor && data.emisor.phone) || '3239421252';
        doc.text(bName, pageWidth - margin, yPos + 4, { align: 'right' });
        doc.text('WhatsApp: ' + bPhone, pageWidth - margin, yPos + 8.5, { align: 'right' });

        yPos += logoH + 6;
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.6);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 7;
      } catch (e) {
        console.warn('Error al cargar logo en cuenta de cobro:', e);
        yPos += 4;
      }
    } else {
      yPos += 4;
    }

    // 1. Ciudad y Fecha (Alineado a la izquierda, negrita)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    const dateText = `${data.city || 'Bogotá D.C.'}, ${formatDateSpanish(data.date)}`;
    doc.text(dateText, margin, yPos);
    yPos += 9;

    // 2. "CUENTA DE COBRO N° 001" (Centrado y negrita destacada)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    const numDisplay = String(data.number || '001').padStart(3, '0');
    doc.text(`CUENTA DE COBRO N° ${numDisplay}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;

    // 3. Cliente / Deudor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.clientName || 'Cliente General', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(data.clientNit ? `NIT / C.C. ${data.clientNit}` : 'NIT / C.C. (Por registrar)', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // 4. "DEBE A:" (Centrado, negrita)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('DEBE A:', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // 5. Nombre del emisor y Cédula
    const emisor = data.emisor || (window.state && window.state.settings) || {};
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((emisor.name || 'Jason').toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`C.C. ${emisor.cc || ''} de ${emisor.city || 'Bogotá D.C.'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;

    // Totales calculados
    let totalConceptos = Number(data.totalConceptos) || 0;
    if (!totalConceptos && Array.isArray(data.conceptos)) {
      totalConceptos = data.conceptos.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }

    const adelantos = (data.adelantos || []).filter(a => (a.desc && a.desc.trim()) || (Number(a.amount) > 0));
    let totalAdelantos = Number(data.totalAdelantos) || 0;
    if (!totalAdelantos && Array.isArray(adelantos)) {
      totalAdelantos = adelantos.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    }

    const saldo = (typeof data.saldo === 'number') ? data.saldo : Math.max(0, totalConceptos - totalAdelantos);

    // 6. "LA SUMA DE:" centrado, en negrita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('LA SUMA DE:', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // 7. El TOTAL de conceptos en letras y números
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const amountText = numeroALetras(totalConceptos);
    const splitAmount = doc.splitTextToSize(amountText, contentWidth - 10);
    doc.text(splitAmount, pageWidth / 2, yPos, { align: 'center' });
    yPos += (splitAmount.length * 5) + 6;

    // 8. "POR CONCEPTO DE:" y cada concepto como viñeta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('POR CONCEPTO DE:', margin, yPos);
    yPos += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const conceptos = data.conceptos && data.conceptos.length > 0 ? data.conceptos : [{ desc: 'Servicios de diseño / desarrollo', amount: totalConceptos }];
    const isSingleConcept = conceptos.length === 1;

    conceptos.forEach(c => {
      const rawDesc = c.desc || 'Servicio';
      const lines = rawDesc.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const firstLine = lines.length > 0 ? lines[0].replace(/^[•\-\*]\s*/, '') : 'Servicio';
      const subLines = lines.slice(1);

      // Título principal con monto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const headPrefix = isSingleConcept ? '' : '•   ';
      const headLine = `${headPrefix}${firstLine} por un valor de ${formatMoney(c.amount || 0)}`;
      const splitHead = doc.splitTextToSize(headLine, contentWidth - 8);
      doc.text(splitHead, margin + (isSingleConcept ? 2 : 4), yPos);
      yPos += (splitHead.length * 4.8);

      // Sub-viñetas indented
      if (subLines.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        subLines.forEach(sub => {
          const cleanSub = sub.replace(/^[•\-\*]\s*/, '');
          const bulletLine = `•  ${cleanSub}`;
          const splitSub = doc.splitTextToSize(bulletLine, contentWidth - 14);
          doc.text(splitSub, margin + (isSingleConcept ? 6 : 10), yPos);
          yPos += (splitSub.length * 4.4);
        });
        doc.setFontSize(9);
      }
      yPos += 2.5;
    });

    // 9. Resumen de anticipos / saldo si los hay
    if (totalAdelantos > 0) {
      yPos += 2;
      const boxWidth = 96;
      const boxHeight = 26;
      const boxX = margin + 4;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text('Total de conceptos:', boxX + 4, yPos + 5.5);
      doc.text(formatMoney(totalConceptos), boxX + boxWidth - 4, yPos + 5.5, { align: 'right' });

      doc.text('Menos anticipos recibidos:', boxX + 4, yPos + 11);
      doc.setTextColor(220, 38, 38);
      doc.text('-' + formatMoney(totalAdelantos), boxX + boxWidth - 4, yPos + 11, { align: 'right' });

      doc.setDrawColor(254, 202, 202);
      doc.line(boxX + 4, yPos + 14, boxX + boxWidth - 4, yPos + 14);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(153, 27, 27);
      doc.text('SALDO A COBRAR:', boxX + 4, yPos + 19);
      doc.text(formatMoney(saldo), boxX + boxWidth - 4, yPos + 19, { align: 'right' });

      yPos += boxHeight + 4;
    } else {
      yPos += 3;
    }

    // 10. Garantías y observaciones
    if (data.includeNotes !== false && data.notes && String(data.notes).trim()) {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('GARANTÍAS Y OBSERVACIONES:', margin, yPos);
      yPos += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const splitObs = doc.splitTextToSize(String(data.notes).trim(), contentWidth);
      doc.text(splitObs, margin, yPos);
      yPos += (splitObs.length * 3.8) + 4;
    }

    // 11. Texto legal de exención tributaria colombiana
    if (data.includeLegal === true) {
      const legalText = data.legalText || (window.state && window.state.settings && window.state.settings.legalText) || '';
      if (legalText) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        const splitLegal = doc.splitTextToSize(legalText.trim(), contentWidth);
        doc.text(splitLegal, margin, yPos);
        yPos += (splitLegal.length * 3.4) + 6;
      }
    }

    // 12. Firma del Emisor
    const signatureBottomY = pageHeight - 25;
    if (emisor.signature) {
      try {
        doc.addImage(emisor.signature, 'PNG', margin + 4, signatureBottomY - 18, 40, 15);
      } catch (e) {
        console.warn('Error al estampar firma en PDF:', e);
      }
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin + 4, signatureBottomY - 2, margin + 65, signatureBottomY - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text((emisor.name || 'Jason').toUpperCase(), margin + 4, signatureBottomY + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`C.C. ${emisor.cc || ''}`, margin + 4, signatureBottomY + 6);

    return doc;
  }

  // ==========================================================================
  // 3. GENERACIÓN DE ARCHIVOS BLOB / FILE Y GESTIÓN DE CACHÉ
  // ==========================================================================
  const pdfDocumentCache = new Map();

  function buildCacheKey(docType, data) {
    return JSON.stringify({
      docType,
      id: data.id,
      number: data.number,
      date: data.date,
      clientName: data.clientName,
      clientPhone: data.clientPhone || data.clientPhoneFull,
      clientNit: data.clientNit,
      clientDesc: data.clientDesc,
      items: data.items,
      conceptos: data.conceptos,
      adelantos: data.adelantos,
      subtotal: data.subtotal,
      discountPct: data.discountPct,
      discountAmount: data.discountAmount,
      extraCharges: data.extraCharges,
      taxRate: data.taxRate,
      taxAmount: data.taxAmount,
      grandTotal: data.grandTotal,
      totalConceptos: data.totalConceptos,
      totalAdelantos: data.totalAdelantos,
      saldo: data.saldo,
      notes: data.notes,
      includeNotes: data.includeNotes,
      includeLogo: data.includeLogo,
      includeLegal: data.includeLegal,
      emisor: data.emisor
    });
  }

  function generatePdfFile(data) {
    const key = buildCacheKey('cotizacion', data);
    if (pdfDocumentCache.has(key)) return pdfDocumentCache.get(key);

    const doc = createPdfDocument(data);
    const sanitizedNumber = String(data.number || 'COT-0001').replace(/[^a-zA-Z0-9_-]/g, '');
    const clientSlug = (data.clientName || 'Cliente').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15);
    const fileName = `Cotizacion_${sanitizedNumber}_${clientSlug}.pdf`;
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf', lastModified: Date.now() });
    const result = { doc, blob, file, fileName };

    pdfDocumentCache.set(key, result);
    return result;
  }

  function generateCobroPdfFile(data) {
    const key = buildCacheKey('cuenta_cobro', data);
    if (pdfDocumentCache.has(key)) return pdfDocumentCache.get(key);

    const doc = createCobroPdfDocument(data);
    const sanitizedNumber = String(data.number || '001').padStart(3, '0').replace(/[^a-zA-Z0-9_-]/g, '');
    const clientSlug = (data.clientName || 'Cliente').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15);
    const fileName = `CuentaDeCobro_${sanitizedNumber}_${clientSlug}.pdf`;
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf', lastModified: Date.now() });
    const result = { doc, blob, file, fileName };

    pdfDocumentCache.set(key, result);
    return result;
  }

  function getCachedPdfFile(docType, data) {
    return (docType === 'cotizacion') ? generatePdfFile(data) : generateCobroPdfFile(data);
  }

  function clearPdfCache() {
    pdfDocumentCache.clear();
  }

  function downloadPdf(data) {
    const { doc, fileName } = getCachedPdfFile('cotizacion', data);
    doc.save(fileName);
  }

  function downloadCobroPdf(data) {
    const { doc, fileName } = getCachedPdfFile('cuenta_cobro', data);
    doc.save(fileName);
  }

  function previewPdfBlob(blob) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 100);
    }
  }

  function previewPdf(data) {
    const { blob } = getCachedPdfFile('cotizacion', data);
    previewPdfBlob(blob);
  }

  function previewCobroPdf(data) {
    const { blob } = getCachedPdfFile('cuenta_cobro', data);
    previewPdfBlob(blob);
  }

  // ==========================================================================
  // 4. FLUJO DE COMPARTIR POR WHATSAPP EXACTO AL DE PEDRO ROA
  // ==========================================================================
  async function shareDocViaWhatsApp(docType, data, onDesktopFallback) {
    const isCot = docType === 'cotizacion';
    const { file, fileName, doc } = getCachedPdfFile(docType, data);

    // Normalizar teléfono del cliente
    let phone = (isCot ? (data.clientPhone || '') : '') || '';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '57' + cleanPhone;

    // Resumen de texto comprensivo
    let messageText = '';
    if (typeof window.generatePlainTextSummary === 'function') {
      messageText = window.generatePlainTextSummary(docType, data);
    } else {
      messageText = isCot
        ? `*UNIVERSO GRÁFICO – COTIZACIÓN ${data.number || ''}*\nHola ${data.clientName || 'estimado cliente'}, adjunto encontrarás la propuesta formal en PDF con los detalles y costos.\n*TOTAL:* ${formatMoney(data.grandTotal || data.subtotal)}`
        : `*UNIVERSO GRÁFICO – CUENTA DE COBRO N° ${data.number || ''}*\nCobro a: ${data.clientName || 'Cliente'}\n*TOTAL:* ${formatMoney(data.totalConceptos)}`;
    }

    const title = isCot
      ? `Cotización ${data.number || ''} - Universo Gráfico`
      : `Cuenta de Cobro ${data.number || ''} - Universo Gráfico`;

    // 1. Mobile Native Web Share API con Archivos (Android, iOS)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: messageText
        });
        return { success: true, method: 'native-share' };
      } catch (err) {
        if (err.name === 'AbortError') {
          return { success: false, aborted: true };
        }
        console.warn('Web Share API con archivos no pudo completarse, activando respaldo:', err);
      }
    }

    // 2. Computador / Desktop o navegador sin soporte de compartir archivos
    // Descarga el PDF automáticamente
    doc.save(fileName);

    // Abre WhatsApp con el enlace oficial
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    const win = window.open(waUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const link = document.createElement('a');
      link.href = waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 200);
    }

    if (typeof onDesktopFallback === 'function') {
      onDesktopFallback(fileName);
    } else if (typeof window.showAppModal === 'function') {
      window.showAppModal(
        '📄 PDF Descargado & WhatsApp Abierto',
        `<p>El archivo <strong>${fileName}</strong> se descargó a tu computador.</p>
         <p style="margin-top: 8px;">En la pestaña de WhatsApp que acabamos de abrir con tu cliente, simplemente <strong>arrastra el PDF</strong> o dale clic en el clip 📎 y selecciona el archivo descargado para enviarlo.</p>`,
        'Entendido'
      );
    }

    return { success: true, method: 'download-and-chat', fileName };
  }

  // Exportar al ámbito global
  window.UniversoGraficoPdf = {
    createPdfDocument,
    generatePdfFile,
    downloadPdf,
    previewPdf,
    createCobroPdfDocument,
    generateCobroPdfFile,
    downloadCobroPdf,
    previewCobroPdf,
    shareDocViaWhatsApp,
    getCachedPdfFile,
    clearPdfCache,
    previewPdfBlob,
    formatMoney,
    formatMoneyCop,
    numeroALetras
  };

})(typeof window !== 'undefined' ? window : this);
