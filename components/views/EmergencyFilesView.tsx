import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { EmergencyFile, FileStatus, TableColumn, NewEmergencyFile } from '../../types';
import FileTable from '../FileTable';
import PersonalFileModal from '../modals/PersonalFileModal';
import { SearchIcon, PlusIcon } from '../icons';
import { format, isBefore } from 'date-fns';
import { parseISO } from 'date-fns';
import { API_BASE_URL } from '../../config';

const EmergencyFilesView: React.FC = () => {
  const [files, setFiles] = useState<EmergencyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FileStatus | 'all'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<EmergencyFile | null>(null);

  const handleUpdate = async (updatedFile: EmergencyFile) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/emergency/${updatedFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedFile),
      });

      if (!response.ok) throw new Error('Failed to update file');
      await fetchFiles(); // Refresh the list after update
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the file');
    }
  };

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/emergency`);
      if (!response.ok) throw new Error('Failed to fetch emergency files');
      const data = await response.json();
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);


  const getStatus = (expiryDate: string): FileStatus => {
    return isBefore(parseISO(expiryDate), new Date()) ? FileStatus.Expired : FileStatus.Active;
  };
  
  const filteredFiles = useMemo(() => {
    return files
      .map(file => ({ ...file, status: getStatus(file.expiryDate) }))
      .filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              file.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || file.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [files, searchTerm, statusFilter]);

  const handleView = (file: EmergencyFile) => alert(`Viewing emergency file for ${file.name}`);
  
  const handleAddNew = () => {
    setFileToEdit(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (file: EmergencyFile) => {
    setFileToEdit(file);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (file: EmergencyFile) => {
    if (window.confirm(`Are you sure you want to delete the file for ${file.name}?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/emergency/${file.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete file');
        fetchFiles();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleSave = async (fileData: NewEmergencyFile | EmergencyFile) => {
    try {
      const isUpdating = 'id' in fileData;
      const url = isUpdating ? `${API_BASE_URL}/api/emergency/${fileData.id}` : `${API_BASE_URL}/api/emergency`;
      const method = isUpdating ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileData),
      });
       if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save file');
      }
      setIsModalOpen(false);
      fetchFiles();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const columns: TableColumn<EmergencyFile & { status: FileStatus }>[] = [
    { key: 'id', header: 'File ID' },
    { key: 'name', header: 'Patient Name' },
    { key: 'age', header: 'Age' },
    { key: 'gender', header: 'Gender' },
    { 
        key: 'registrationDate', 
        header: 'Registration Date',
        render: (item) => format(parseISO(item.registrationDate), 'MMM dd, yyyy')
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (item) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            item.status === FileStatus.Active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
            {item.status}
        </span>
      )
    },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800">Emergency Files</h2>
      <div className="flex items-center justify-between my-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sjmc-blue-light"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <SearchIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        <div>
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FileStatus | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sjmc-blue-light"
            >
                <option value="all">All Statuses</option>
                <option value={FileStatus.Active}>Active</option>
                <option value={FileStatus.Expired}>Expired</option>
            </select>
        </div>
        <button onClick={handleAddNew} className="flex items-center px-4 py-2 font-medium text-white rounded-md bg-sjmc-blue hover:bg-sjmc-blue-dark">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add New Emergency File
        </button>
      </div>
      {isLoading && <p>Loading files...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!isLoading && !error && (
        <FileTable data={filteredFiles} columns={columns} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      <PersonalFileModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        fileToEdit={fileToEdit}
      />
    </div>
  );
};

export default EmergencyFilesView;