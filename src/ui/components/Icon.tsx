import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { IconName } from './iconPaths';
import { ICON_SHAPES } from './iconPaths';

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_SHAPES[name].map((shape, index) => {
        if (shape.kind === 'path') return <Path key={index} d={shape.d} />;
        if (shape.kind === 'rect') {
          return (
            <Rect
              key={index}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rx={shape.rx}
            />
          );
        }
        return <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />;
      })}
    </Svg>
  );
}
