import { useRef, useState } from 'react';

export default function Profile({ profile, setProfile }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(profile);

  const profilePicInputRef = useRef(null);
  const coverPhotoInputRef = useRef(null);

  const handleOpenModal = () => {
    setEditForm(profile);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSaveModal = () => {
    setProfile(editForm);
    setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, [fieldName]: reader.result }));
        setEditForm(prev => ({ ...prev, [fieldName]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <section className="profile-card">
        <div 
          className="cover-photo-container" 
          onClick={() => coverPhotoInputRef.current.click()}
        >
          <img src={profile.coverPhoto} alt="Cover" />
          <div className="edit-overlay">Click to change cover</div>
          <input 
            type="file" 
            accept="image/*" 
            ref={coverPhotoInputRef}
            style={{ display: 'none' }}
            onChange={(e) => handleImageUpload(e, 'coverPhoto')}
          />
        </div>
        
        <div className="profile-info">
          <div className="profile-header-top">
            <div 
              className="profile-pic-container"
              onClick={() => profilePicInputRef.current.click()}
            >
              <img src={profile.profilePic} alt={profile.fullName} className="profile-pic" />
              <div className="edit-overlay">Edit</div>
              <input 
                type="file" 
                accept="image/*" 
                ref={profilePicInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleImageUpload(e, 'profilePic')}
              />
            </div>
            
            <button className="btn-edit-profile" onClick={handleOpenModal} aria-label="Edit Profile">
              <svg viewBox="0 0 24 24">
                <path d="M21.13 2.85a2.89 2.89 0 00-4.08 0l-1.42 1.42 4.08 4.08 1.42-1.42a2.89 2.89 0 000-4.08zM4 15.92L14.08 5.85l4.08 4.08L8.08 20H4v-4.08z" />
              </svg>
            </button>
          </div>
          
          <h1 className="profile-name">{profile.fullName}</h1>
          <h2 className="profile-headline">{profile.headline}</h2>
          <p className="profile-location">{profile.location}</p>
          
          <div className="action-buttons">
            <button className="btn-primary">Connect</button>
            <button className="btn-secondary">Message</button>
          </div>
        </div>
      </section>

      <section className="profile-card about-card">
        <h2 className="section-title">About</h2>
        <p className="about-text">{profile.about}</p>
      </section>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit intro</h2>
              <button className="btn-close" onClick={handleCloseModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  name="fullName"
                  className="form-input" 
                  value={editForm.fullName} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="form-group">
                <label>Headline</label>
                <input 
                  type="text" 
                  name="headline"
                  className="form-input" 
                  value={editForm.headline} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input 
                  type="text" 
                  name="location"
                  className="form-input" 
                  value={editForm.location} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="form-group">
                <label>About</label>
                <textarea 
                  name="about"
                  className="form-textarea" 
                  value={editForm.about} 
                  onChange={handleInputChange} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSaveModal}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
