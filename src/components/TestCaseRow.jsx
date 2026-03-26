import React, { useState, useRef, useEffect, useCallback } from 'react';

const TEST_OPTIONS = ['Yes', 'To Do', 'undefined'];
const RESULT_OPTIONS = ['Not Run', 'Passed', 'Failed'];

const getTestBgClass = (value) => {
  if (value === 'Yes') return 'bg-green-100 text-green-700';
  if (value === 'To Do') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-500';
};

const getResultClass = (value) => {
  if (value === 'Passed') return 'bg-green-500 text-white';
  if (value === 'Failed') return 'bg-red-500 text-white';
  return 'text-gray-500';
};

const TestCaseRow = ({ testCase, index, onUpdate, onDelete }) => {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const startEdit = useCallback((field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  }, []);

  const commitEdit = useCallback(() => {
    if (editingField) {
      onUpdate?.({ ...testCase, [editingField]: editValue });
      setEditingField(null);
      setEditValue('');
    }
  }, [editingField, editValue, testCase, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  }, [commitEdit, cancelEdit]);

  const handleDropdownChange = useCallback((field, value) => {
    onUpdate?.({ ...testCase, [field]: value });
    setEditingField(null);
  }, [testCase, onUpdate]);

  const renderCell = (field, value, isDropdown = false, options = []) => {
    if (editingField === field) {
      if (isDropdown) {
        return (
          <select
            ref={inputRef}
            value={editValue}
            onChange={(e) => handleDropdownChange(field, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none"
        />
      );
    }
    return (
      <span
        className="cursor-pointer block w-full"
        onClick={() => startEdit(field, value)}
      >
        {value || '\u00A0'}
      </span>
    );
  };

  const isEven = index % 2 === 0;

  return (
    <tr className={`hover:bg-blue-50 transition-colors ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Row number */}
      <td className="px-3 py-2 text-center text-sm text-gray-500 border-r border-gray-200">
        {index + 1}
      </td>

      {/* Feature (A) */}
      <td className="px-3 py-2 text-sm border-r border-gray-200">
        {renderCell('feature', testCase.feature)}
      </td>

      {/* Test Case Description (B) */}
      <td className="px-3 py-2 text-sm border-r border-gray-200">
        {renderCell('description', testCase.description)}
      </td>

      {/* Test to Perform (C) */}
      <td className="px-3 py-2 text-sm border-r border-gray-200">
        {renderCell('testToPerform', testCase.testToPerform)}
      </td>

      {/* ?Test (D) */}
      <td className={`px-3 py-2 text-sm text-center border-r border-gray-200 ${getTestBgClass(testCase.shouldTest)}`}>
        {renderCell('shouldTest', testCase.shouldTest, true, TEST_OPTIONS)}
      </td>

      {/* Result (E) */}
      <td className={`px-3 py-2 text-sm text-center border-r border-gray-200 ${getResultClass(testCase.result)}`}>
        {renderCell('result', testCase.result, true, RESULT_OPTIONS)}
      </td>

      {/* Issue (F) */}
      <td className="px-3 py-2 text-sm border-r border-gray-200">
        {testCase.issue && /^[A-Z]+-\d+$/.test(testCase.issue) ? (
          <a
            href={`https://jira.example.com/browse/${testCase.issue}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {testCase.issue}
          </a>
        ) : (
          renderCell('issue', testCase.issue)
        )}
      </td>

      {/* Note (G) */}
      <td className="px-3 py-2 text-sm">
        {renderCell('note', testCase.note)}
      </td>
    </tr>
  );
};

export default TestCaseRow;
