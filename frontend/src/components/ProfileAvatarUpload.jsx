import React, { useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI, handleApiError } from '../utils/api';

const MAX_SIZE_MB = 5;

/** Avatar with optional profile-picture upload (authenticated users). */
export default function ProfileAvatarUpload({
    sizeClass = 'w-28 h-28',
    initialClass = 'text-4xl',
    guestIconClass = 'w-14 h-14',
    cameraBtnClass = 'w-8 h-8',
    isDark = false,
    className = '',
    onSuccess,
}) {
    const { user, token, updateUser, isAuthenticated } = useAuth();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const showImage = isAuthenticated && user?.profilePic && !imgError;
    const showInitial = isAuthenticated && user?.name && !showImage;

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !token) return;

        setUploadError('');

        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file.');
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setUploadError(`Image must be under ${MAX_SIZE_MB}MB.`);
            return;
        }

        setUploading(true);
        setImgError(false);

        try {
            const { url } = await authAPI.uploadProfileImage(token, file);
            const response = await authAPI.updateProfile(token, { profilePic: url });
            if (response.success) {
                updateUser(response.data.user);
                onSuccess?.();
            } else {
                setUploadError(response.message || 'Failed to save profile picture.');
            }
        } catch (err) {
            setUploadError(handleApiError(err) || 'Failed to upload profile picture.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div className="relative shrink-0">
                <div
                    className={`${sizeClass} rounded-full flex items-center justify-center overflow-hidden ${
                        showImage || showInitial
                            ? 'bg-linear-to-br from-[#007BFF] to-[#00C9A7]'
                            : isDark
                              ? 'bg-gray-700'
                              : 'bg-gray-200'
                    }`}
                >
                    {showImage ? (
                        <img
                            src={user.profilePic}
                            alt={user.name || 'Profile'}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : showInitial ? (
                        <span className={`text-white font-bold ${initialClass}`}>
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                    ) : (
                        <User className={`${guestIconClass} ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                    )}
                </div>

                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                )}

                {isAuthenticated && (
                    <>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            aria-label="Upload profile picture"
                            className={`absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 shadow-md transition-colors disabled:opacity-60 ${cameraBtnClass} ${
                                isDark
                                    ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </>
                )}
            </div>
            {uploadError && (
                <p className="text-xs text-red-500 mt-1.5 text-center max-w-[10rem]">{uploadError}</p>
            )}
        </div>
    );
}
