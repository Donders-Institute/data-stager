package path

import "os"

// PathType represents the namespace type a path is referring to.
type PathType int

const (
	// TypeFileSystem is the namespace type for local filesystem.
	TypeFileSystem PathType = iota
	// TypeIrods is the the namespace type for iRODS.
	TypeIrods
)

// PathInfo defines a data structure of the path information.
type PathInfo struct {
	// Path is the path in question.
	Path string
	// PathType is the namespace type of the path.
	Type PathType
	// Mode is the `os.FileMode` of the path.
	Mode os.FileMode
}
