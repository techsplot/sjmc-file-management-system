import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ReferralFile, FileStatus, TableColumn, NewReferralFile } from '../../types';
import FileTable from '../FileTable';
import ReferralFileModal from '../modals/ReferralFileModal';
import { SearchIcon, PlusIcon } from '../icons';
import { format, isBefore, parseISO } from 'date-fns';
import { API_BASE_URL } from '../../config';

const ReferralFilesView: React.FC = () => {
  const [files, setFiles] = useState<ReferralFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<ReferralFile | null>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/referral`);
      if (!response.ok) throw new Error('Failed to fetch referral files');
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
        return file.referralName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               file.id.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [files, searchTerm]);

  const handleView = (file: ReferralFile) => alert(`Viewing referral file for ${file.referralName}`);

  const handleAddNew = () => {
    setFileToEdit(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (file: ReferralFile) => {
    setFileToEdit(file);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (file: ReferralFile) => {
    if (window.confirm(`Are you sure you want to delete the file for ${file.referralName}?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/referral/${file.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete file');
        fetchFiles();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleSave = async (fileData: NewReferralFile | ReferralFile) => {
    try {
      const isUpdating = 'id' in fileData;
      const url = isUpdating ? `${API_BASE_URL}/api/referral/${fileData.id}` : `${API_BASE_URL}/api/referral`;
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


  const columns: TableColumn<ReferralFile & { status: FileStatus }>[] = [
    { key: 'id', header: 'Referral ID' },
    { key: 'referralName', header: 'Referral Name' },
    { key: 'patientCount', header: 'Patients Referred' },
    { 
        key: 'registrationDate', 
        header: 'Registration Date',
        render: (item) => format(parseISO(item.registrationDate), 'MMM dd, yyyy')
    },
    { 
        key: 'expiryDate', 
        header: 'Expiry Date',
        render: (item) => format(parseISO(item.expiryDate), 'MMM dd, yyyy')
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
      <h2 className="text-3xl font-bold text-gray-800">Referral Files</h2>
      <div className="flex items-center justify-between my-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by referral name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sjmc-blue-light"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <SearchIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        <button onClick={handleAddNew} className="flex items-center px-4 py-2 font-medium text-white rounded-md bg-sjmc-blue hover:bg-sjmc-blue-dark">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add New Referral File
        </button>
      </div>
       {isLoading && <p>Loading files...</p>}
       {error && <p className="text-red-500">Error: {error}</p>}
       {!isLoading && !error && (
        <FileTable data={filteredFiles} columns={columns} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
       )}
       <ReferralFileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        fileToEdit={fileToEdit}
      />
    </div>
  );
};

export default ReferralFilesView;