
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Song } from '../types';

interface EmbeddingMapProps {
  songs: Song[];
  selectedSongId?: string;
  onSelectSong: (song: Song) => void;
  searchQuery?: string;
}

const EmbeddingMap: React.FC<EmbeddingMapProps> = ({ songs, selectedSongId, onSelectSong, searchQuery = '' }) => {
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
      .attr("stroke-opacity", 0.3)
      .call(d3.axisBottom(x).ticks(5).tickSize(height).tickFormat(() => ""));

    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#1f2937")
      .attr("stroke-opacity", 0.3)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ""));

    const query = searchQuery.toLowerCase();

    // Plot points
    g.selectAll("circle")
      .data(songs)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.embedding[0]))
      .attr("cy", d => y(d.embedding[1]))
      .attr("r", d => {
        const isMatch = query && (
          d.title.toLowerCase().includes(query) || 
          d.artist.toLowerCase().includes(query) || 
          d.genre.toLowerCase().includes(query)
        );
        if (d.id === selectedSongId) return 10;
        return isMatch ? 8 : 4;
      })
      .attr("fill", d => colorScale(d.clusterId.toString()))
      .attr("stroke", d => d.id === selectedSongId ? "#fff" : "none")
      .attr("stroke-width", 2)
      .attr("opacity", d => {
        if (!query) return 1;
        const isMatch = d.title.toLowerCase().includes(query) || 
                        d.artist.toLowerCase().includes(query) || 
                        d.genre.toLowerCase().includes(query);
        return isMatch || d.id === selectedSongId ? 1 : 0.15;
      })
      .attr("class", "cursor-pointer transition-all duration-300 hover:scale-150")
      .on("click", (event, d) => onSelectSong(d));

    // Axis labels
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .style("font-size", "9px")
      .style("font-weight", "800")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.1em")
      .text("Latent Dimension A");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#4b5563")
      .style("font-size", "9px")
      .style("font-weight", "800")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.1em")
      .text("Latent Dimension B");

  }, [songs, selectedSongId, onSelectSong, searchQuery]);

  return (
    <div className="bg-black/40 rounded-[2.5rem] p-6 shadow-inner border border-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Acoustic Manifold Projection</h3>
        {searchQuery && (
          <span className="text-[9px] font-black text-[#1DB954] uppercase animate-pulse tracking-widest">
            Filtering Map...
          </span>
        )}
      </div>
      <svg ref={svgRef} width="100%" height="400" viewBox="0 0 400 400" className="mx-auto" />
      <div className="mt-6 flex flex-wrap justify-center gap-6 text-[9px] font-black text-gray-600 uppercase tracking-widest border-t border-white/5 pt-6">
        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#1f77b4]"></div> Synthetics</span>
        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ff7f0e]"></div> Harmonics</span>
        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#2ca02c]"></div> Perceptual</span>
      </div>
    </div>
  );
};

export default EmbeddingMap;
