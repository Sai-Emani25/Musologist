
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Song } from '../types';

interface EmbeddingMapProps {
  songs: Song[];
  selectedSongId?: string;
  onSelectSong: (song: Song) => void;
}

const EmbeddingMap: React.FC<EmbeddingMapProps> = ({ songs, selectedSongId, onSelectSong }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = 400 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([-1.2, 1.2]).range([0, width]);
    const y = d3.scaleLinear().domain([-1.2, 1.2]).range([height, 0]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#1f2937")
      .attr("stroke-opacity", 0.5)
      .call(d3.axisBottom(x).ticks(5).tickSize(height).tickFormat(() => ""));

    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#1f2937")
      .attr("stroke-opacity", 0.5)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ""));

    // Plot points
    g.selectAll("circle")
      .data(songs)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.embedding[0]))
      .attr("cy", d => y(d.embedding[1]))
      .attr("r", d => d.id === selectedSongId ? 8 : 5)
      .attr("fill", d => colorScale(d.clusterId.toString()))
      .attr("stroke", d => d.id === selectedSongId ? "#fff" : "none")
      .attr("stroke-width", 2)
      .attr("class", "cursor-pointer transition-all hover:r-10")
      .on("click", (event, d) => onSelectSong(d));

    // Axis labels
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .style("font-size", "10px")
      .text("Latent Dimension 1 (Timbre)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .style("font-size", "10px")
      .text("Latent Dimension 2 (Rhythm)");

  }, [songs, selectedSongId, onSelectSong]);

  return (
    <div className="bg-gray-900 rounded-xl p-4 shadow-inner border border-gray-800">
      <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Song Embedding Space</h3>
      <svg ref={svgRef} width="100%" height="400" viewBox="0 0 400 400" className="mx-auto" />
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Electronic</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Folk/Jazz</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Heavy Bass</span>
      </div>
    </div>
  );
};

export default EmbeddingMap;
