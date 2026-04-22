'use client';

import { useState, useRef } from 'react';
import KeyValueTable, { 
  KeyValueEntry, 
  areEntriesValid, 
  entriesToJson, 
  jsonToEntries 
} from './KeyValueTable';
import { TestCase } from '@/app/api/create_test_case/types';
import { updateTestCase } from '@/app/api/update_test_case/frontend';

type TestCaseEditorProps = {
  testCase: TestCase;
  onDelete: (uid: string) => void;
  onUpdate?: (testCase: TestCase) => void;
};

export default function TestCaseEditor({ testCase, onDelete, onUpdate }: TestCaseEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(testCase.name);
  
  // Seed state
  const [seedRegisters, setSeedRegisters] = useState<KeyValueEntry[]>(() => 
    jsonToEntries(testCase.seed_registers)
  );
  const [seedMemory, setSeedMemory] = useState<KeyValueEntry[]>(() => 
    jsonToEntries(testCase.seed_memory)
  );
  
  // Result state
  const [resultRegisters, setResultRegisters] = useState<KeyValueEntry[]>(() => 
    jsonToEntries(testCase.result_registers)
  );
  const [resultMemory, setResultMemory] = useState<KeyValueEntry[]>(() => 
    jsonToEntries(testCase.result_memory)
  );
  
  // Counter-based dirty tracking
  const [oldCounter, setOldCounter] = useState(0);
  const [newCounter, setNewCounter] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Ref to track pending timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if all data is valid
  const checkValidity = (
    nameVal: string,
    seedRegs: KeyValueEntry[],
    seedMem: KeyValueEntry[],
    resultRegs: KeyValueEntry[],
    resultMem: KeyValueEntry[]
  ): boolean => {
    return (
      nameVal.trim().length > 0 &&
      areEntriesValid(seedRegs, 'registers') &&
      areEntriesValid(seedMem, 'memory') &&
      areEntriesValid(resultRegs, 'registers') &&
      areEntriesValid(resultMem, 'memory')
    );
  };
  
  // Handle any field change
  const handleChange = (
    nameVal: string,
    seedRegs: KeyValueEntry[],
    seedMem: KeyValueEntry[],
    resultRegs: KeyValueEntry[],
    resultMem: KeyValueEntry[]
  ) => {
    // Check validity
    const isValid = checkValidity(nameVal, seedRegs, seedMem, resultRegs, resultMem);
    
    if (!isValid) {
      setHasError(true);
      // Clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    setHasError(false);
    
    // Increment counter to mark as dirty
    const expectedCounter = newCounter + 1;
    setNewCounter(expectedCounter);
    
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Schedule save after 200ms
    timerRef.current = setTimeout(async () => {
      // Re-check validity before saving
      if (!checkValidity(nameVal, seedRegs, seedMem, resultRegs, resultMem)) {
        setHasError(true);
        return;
      }
      
      setIsUpdating(true);
      
      try {
        const response = await updateTestCase({
          uid: testCase.uid,
          name: nameVal.trim(),
          seed_registers: entriesToJson(seedRegs),
          seed_memory: entriesToJson(seedMem),
          result_registers: entriesToJson(resultRegs),
          result_memory: entriesToJson(resultMem),
        });
        
        if (response.success) {
          // Only mark as up-to-date if counter hasn't changed
          setNewCounter(prev => {
            if (prev === expectedCounter) {
              setOldCounter(expectedCounter);
            }
            return prev;
          });
          
          if (onUpdate && response.testCase) {
            onUpdate(response.testCase);
          }
        } else {
          console.error('Save failed:', response.message);
        }
      } catch (error) {
        console.error('Save error:', error);
      } finally {
        setIsUpdating(false);
      }
    }, 200);
  };
  
  // Wrapper functions for each field change
  const handleNameChange = (newName: string) => {
    setName(newName);
    handleChange(newName, seedRegisters, seedMemory, resultRegisters, resultMemory);
  };
  
  const handleSeedRegistersChange = (entries: KeyValueEntry[]) => {
    setSeedRegisters(entries);
    handleChange(name, entries, seedMemory, resultRegisters, resultMemory);
  };
  
  const handleSeedMemoryChange = (entries: KeyValueEntry[]) => {
    setSeedMemory(entries);
    handleChange(name, seedRegisters, entries, resultRegisters, resultMemory);
  };
  
  const handleResultRegistersChange = (entries: KeyValueEntry[]) => {
    setResultRegisters(entries);
    handleChange(name, seedRegisters, seedMemory, entries, resultMemory);
  };
  
  const handleResultMemoryChange = (entries: KeyValueEntry[]) => {
    setResultMemory(entries);
    handleChange(name, seedRegisters, seedMemory, resultRegisters, entries);
  };
  
  // Derive status from state
  const getStatus = (): 'uptodate' | 'error' | 'unsaved' | 'updating' => {
    if (hasError) return 'error';
    if (isUpdating) return 'updating';
    if (oldCounter !== newCounter) return 'unsaved';
    return 'uptodate';
  };
  
  // Status indicator component
  const StatusIndicator = () => {
    const status = getStatus();
    
    switch (status) {
      case 'updating':
        return (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <span className="animate-spin">⟳</span> Updating...
          </span>
        );
      case 'error':
        return <span className="text-xs text-red-600">✕ Autoupdate blocked, error detected</span>;
      case 'unsaved':
        return <span className="text-xs text-yellow-600">● Unsaved, about to save</span>;
      case 'uptodate':
        return <span className="text-xs text-green-600">✓ Up to date</span>;
    }
  };
  
  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 mb-3">
      {/* Header - always visible */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
          <span className="font-medium text-gray-800">{testCase.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator />
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete test case "${testCase.name}"?`)) {
                onDelete(testCase.uid);
              }
            }}
            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
          >
            Delete
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-gray-200 bg-white">
          {/* Name field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Case Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-black ${
                name.trim().length > 0 
                  ? 'border-gray-300' 
                  : 'border-red-500 bg-red-50'
              } focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Test case name"
            />
          </div>
          
          {/* Seed Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
              Seed (Initial State)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KeyValueTable
                title="Registers"
                type="registers"
                entries={seedRegisters}
                onChange={handleSeedRegistersChange}
              />
              <KeyValueTable
                title="Memory"
                type="memory"
                entries={seedMemory}
                onChange={handleSeedMemoryChange}
              />
            </div>
          </div>
          
          {/* Result Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
              Result (Expected Final State)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KeyValueTable
                title="Registers"
                type="registers"
                entries={resultRegisters}
                onChange={handleResultRegistersChange}
              />
              <KeyValueTable
                title="Memory"
                type="memory"
                entries={resultMemory}
                onChange={handleResultMemoryChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
