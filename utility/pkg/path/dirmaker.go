package path

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	log "github.com/sirupsen/logrus"
)

// NewDirMaker determines the path type and returns a corresponding
// implementation of the DirMaker interface.
func NewDirMaker(path PathInfo) DirMaker {
	switch path.Type {
	case TypeIrods:
		return IrodsCollectionMaker{base: path.Path}
	default:
		return FileSystemDirMaker{base: path.Path}
	}
}

// DirMaker defines interface for implementing directory creation in local filesystem and iRODS.
type DirMaker interface {
	Mkdir(path string) error
}

// FileSystemDirMaker implements the DirMaker for local filesystem.
type FileSystemDirMaker struct {
	// Base is the top-level directory.
	base string
}

// Mkdir ensures the directory referred by the path is created.
func (m FileSystemDirMaker) Mkdir(path string) error {

	if !strings.HasPrefix(path, m.base) {
		path = filepath.Join(m.base, path)
	}

	log.Debugf("creating directory %s", path)

	return os.MkdirAll(path, 0775)
}

// IrodsCollectionMaker implements the DirMaker for iRODS, using the `imkdir` system call.
type IrodsCollectionMaker struct {
	// Base is the top-level collection.
	base string
}

// Mkdir ensures the iRODS collection referred by the path is created.
func (m IrodsCollectionMaker) Mkdir(coll string) error {

	// trim the possible leading `i:` used in the syntax of "irsync" for referring to iRODS namespace.
	coll = strings.TrimPrefix(coll, "i:")

	if !strings.HasPrefix(coll, m.base) {
		coll = filepath.Join(m.base, coll)
	}

	log.Debugf("creating collection %s", coll)

	_, err := exec.Command("imkdir", "-p", coll).Output()
	if err != nil {
		return fmt.Errorf("cannot create %s: %s", coll, err)
	}

	return nil
}
