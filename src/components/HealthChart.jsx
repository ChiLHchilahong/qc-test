import React from 'react';
import { Bar } from 'react-chartjs-2';
import { capitalizeDisplayName } from '../utils/textFormat';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const HealthChart = ({ projectName, versions = [] }) => {
  const displayProjectName = capitalizeDisplayName(projectName);

  if (versions.length === 0) {
    return (
      <div className="rounded-[22px] border border-[#d8e0ec] bg-[#f8fafc] p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-[36px] font-extrabold leading-none tracking-[-0.01em] text-[#0d1d3b]">
              {displayProjectName}
            </h3>
            <p className="mt-2 text-sm font-semibold text-[#9aa8be]">Version progression</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a7b5ca]">Versions</p>
            <p className="text-[36px] font-extrabold leading-none text-[#2f5bff]">0</p>
          </div>
        </div>
        <div className="flex h-[186px] items-center justify-center rounded-xl bg-[#f0f4f9] text-sm font-medium text-[#9caac0]">
          No versions created yet.
        </div>
      </div>
    );
  }

  const data = {
    labels: versions.map((v) => capitalizeDisplayName(v.name)),
    datasets: [
      {
        label: 'Failed',
        data: versions.map((v) => v.failed),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderRadius: 4,
      },
      {
        label: 'Warning',
        data: versions.map((v) => v.warning || 0),
        backgroundColor: 'rgba(249, 115, 22, 0.85)',
        borderRadius: 4,
      },
      {
        label: 'Passed',
        data: versions.map((v) => v.passed),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          boxWidth: 8,
          boxHeight: 8,
          color: '#46566f',
          font: {
            size: 11,
            weight: '600',
          },
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: '#5d6f8a',
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#5d6f8a',
          font: {
            size: 11,
          },
        },
        border: { display: false },
        grid: {
          color: '#e5ebf4',
          drawTicks: false,
        },
      },
    },
  };

  return (
    <div className="rounded-[22px] border border-[#d8e0ec] bg-[#f8fafc] p-7">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-[36px] font-extrabold leading-none tracking-[-0.01em] text-[#0d1d3b]">
            {displayProjectName}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#9aa8be]">Version progression</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a7b5ca]">Versions</p>
          <p className="text-[36px] font-extrabold leading-none text-[#2f5bff]">{versions.length}</p>
        </div>
      </div>
      <div className="h-[230px]">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default HealthChart;
