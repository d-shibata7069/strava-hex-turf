declare module "@mapbox/polyline" {
  const polyline: {
    decode(str: string, precision?: number): [number, number][];
    encode(coordinates: [number, number][], precision?: number): string;
  };
  export default polyline;
}
