import React, { useState, useEffect } from 'react';
import { PersonalFile, NewPersonalFile, Gender, FileStatus } from '../../types';
import { XIcon } from '../icons';
import { isBefore, parseISO } from 'date-fns';

interface PersonalFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: NewPersonalFile | PersonalFile) => void;
  fileToEdit: PersonalFile | null;
}

const PersonalFileModal: React.FC<PersonalFileModalProps> = ({ isOpen, onClose, onSave, fileToEdit }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: Gender.Other,
    registrationDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    status: FileStatus.Active,
  });

  const getStatusFromExpiryDate = (expiryDate: string): FileStatus => {
    const normalizedExpiryDate = expiryDate.includes(' ') ? expiryDate.replace(' ', 'T') : expiryDate;
    return isBefore(parseISO(normalizedExpiryDate), new Date()) ? FileStatus.Expired : FileStatus.Active;
  };

  const getDateInputValue = (dateValue: string): string => {
    return dateValue.split(' ')[0].split('T')[0];
  };

  const getExpiryDateFromStatus = (status: FileStatus): string => {
    if (status === FileStatus.Expired) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (fileToEdit) {
      setFormData({
        name: fileToEdit.name,
        age: String(fileToEdit.age),
        gender: fileToEdit.gender,
        registrationDate: getDateInputValue(fileToEdit.registrationDate),
        expiryDate: getDateInputValue(fileToEdit.expiryDate),
        status: getStatusFromExpiryDate(fileToEdit.expiryDate),
      });
    } else {
      setFormData({
        name: '', 
        age: '', 
        gender: Gender.Other,
        registrationDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        status: FileStatus.Active,
      });
    }
  }, [fileToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'status') {
      const nextStatus = value as FileStatus;
      setFormData(prev => ({
        ...prev,
        status: nextStatus,
        expiryDate: getExpiryDateFromStatus(nextStatus)
      }));
      return;
    }

    if (name === 'expiryDate') {
      setFormData(prev => ({
        ...prev,
        expiryDate: value,
        status: getStatusFromExpiryDate(value)
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0' || e.target.value === '1') {
      setFormData(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAge = parseInt(formData.age, 10);

    if (!formData.name.trim() || Number.isNaN(parsedAge) || parsedAge <= 0 || !formData.registrationDate || !formData.expiryDate) {
      return;
    }

    const originalRegistrationDate = fileToEdit ? getDateInputValue(fileToEdit.registrationDate) : '';
    const originalExpiryDate = fileToEdit ? getDateInputValue(fileToEdit.expiryDate) : '';

    const payload: NewPersonalFile = {
      name: formData.name.trim(),
      age: parsedAge,
      gender: formData.gender,
      registrationDate:
        fileToEdit && formData.registrationDate === originalRegistrationDate
          ? fileToEdit.registrationDate
          : `${formData.registrationDate} 00:00:00`,
      expiryDate:
        fileToEdit && formData.expiryDate === originalExpiryDate
          ? fileToEdit.expiryDate
          : `${formData.expiryDate} 00:00:00`
    };

    if (fileToEdit) {
      onSave({
        ...payload,
        id: fileToEdit.id,
      });
    } else {
      onSave(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XIcon className="w-6 h-6" />
        </button>
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          {fileToEdit ? 'Edit Personal File' : 'Add New Personal File'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Patient Name</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
              <input type="number" name="age" id="age" value={formData.age} onFocus={handleNumberFocus} onChange={handleChange} required min="1" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
              <select name="gender" id="gender" value={formData.gender} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm">
                {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
              <select name="status" id="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm">
                <option value={FileStatus.Active}>{FileStatus.Active}</option>
                <option value={FileStatus.Expired}>{FileStatus.Expired}</option>
              </select>
            </div>
            <div>
              <label htmlFor="registrationDate" className="block text-sm font-medium text-gray-700">Registration Date</label>
              <input 
                type="date" 
                name="registrationDate" 
                id="registrationDate" 
                value={formData.registrationDate} 
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">Expiry Date</label>
              <input 
                type="date" 
                name="expiryDate" 
                id="expiryDate" 
                value={formData.expiryDate} 
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sjmc-blue-light focus:border-sjmc-blue-light sm:text-sm"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sjmc-blue-light">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sjmc-blue border border-transparent rounded-md shadow-sm hover:bg-sjmc-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sjmc-blue">
              Save File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalFileModal;
