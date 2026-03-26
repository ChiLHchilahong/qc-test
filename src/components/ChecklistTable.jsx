import React from 'react';
import TestCaseRow from './TestCaseRow';

const COLUMNS = [
  { key: 'row', label: '#', width: 'w-12' },
  { key: 'feature', label: 'Feature (A)', width: 'w-32' },
  { key: 'description', label: 'Test Case Description (B)', width: 'w-64' },
  { key: 'testToPerform', label: 'Test to Perform (C)', width: 'w-64' },
  { key: 'shouldTest', label: '?Test (D)', width: 'w-24' },
  { key: 'result', label: 'Result (E)', width: 'w-28' },
  { key: 'issue', label: 'Issue (F)', width: 'w-28' },
  { key: 'note', label: 'Note (G)', width: 'w-40' },
];

const ChecklistTable = ({ testCases = [], onUpdateTestCase, onDeleteTestCase }) => {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr style={{ backgroundColor: '#1a1f36' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider ${col.width}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-200">
            {testCases.length > 0 ? (
              testCases.map((tc, idx) => (
                <TestCaseRow
                  key={tc.id || idx}
                  testCase={tc}
                  index={idx}
                  onUpdate={onUpdateTestCase}
                  onDelete={onDeleteTestCase}
                />
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-gray-400">
                  No test cases yet. Add your first test case to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChecklistTable;
