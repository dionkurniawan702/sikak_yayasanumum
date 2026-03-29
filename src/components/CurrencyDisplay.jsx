import React from 'react';
import { formatRupiah, getRupiahColor } from '../utils/format';

/**
 * Komponen untuk menampilkan mata uang Rupiah secara seragam
 */
const CurrencyDisplay = ({ 
  value = 0, 
  style = {}, 
  className = '', 
  useColor = true,
  prefix = '' 
}) => {
  const color = useColor ? getRupiahColor(value) : (style.color || 'inherit');
  const finalStyle = {
    ...style,
    color,
    fontWeight: style.fontWeight || 'inherit'
  };

  return (
    <span className={className} style={finalStyle}>
      {prefix}{formatRupiah(value)}
    </span>
  );
};

export default CurrencyDisplay;
